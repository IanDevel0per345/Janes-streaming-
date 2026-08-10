import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/session";
import { SessionData } from "@/types";
import { config } from "@/lib/config";
import { handleApiError } from "@/lib/api-utils";
import axios from "axios";

// 1500 sessions x 20 = 30,000 filmes
const MAX_SESSIONS = 1500;

interface TmdbMovie {
  id: number;
  title: string;
  overview?: string;
  original_language?: string;
  release_date?: string;
  vote_average?: number;
  poster_path?: string;
  backdrop_path?: string;
  genre_ids?: number[];
}

interface TmdbResponse {
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
  page: number;
}

/**
 * Estrategias de busca TMDB para cobrir 30k+ filmes unicos.
 * Cada faixa de sessions usa um sort/filter diferente.
 */
function getDiscoverStrategy(sessionPage: number) {
  if (sessionPage <= 500) {
    // Blocos 1-500: Populares (vote_count >= 50)
    return {
      sort_by: "popularity.desc",
      "vote_count.gte": 50,
      page: sessionPage,
    };
  } else if (sessionPage <= 750) {
    // Blocos 501-750: Alta receita (vote_count >= 10)
    const p = sessionPage - 500;
    return {
      sort_by: "revenue.desc",
      "vote_count.gte": 10,
      page: p,
    };
  } else if (sessionPage <= 1000) {
    // Blocos 751-1000: Lancamentos recentes (vote_count >= 5)
    const p = sessionPage - 750;
    return {
      sort_by: "release_date.desc",
      "vote_count.gte": 5,
      page: p,
    };
  } else if (sessionPage <= 1250) {
    // Blocos 1001-1250: Mais bem avaliados (vote_count >= 20)
    const p = sessionPage - 1000;
    return {
      sort_by: "vote_average.desc",
      "vote_count.gte": 20,
      page: p,
    };
  } else {
    // Blocos 1251-1500: Populares sem filtro de votos
    const p = sessionPage - 1250;
    return {
      sort_by: "popularity.desc",
      "vote_count.gte": 1,
      page: p,
    };
  }
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const searchTerm = searchParams.get("searchTerm") || undefined;
  const sessionPage = Math.max(1, Math.min(parseInt(searchParams.get("session") || "1"), MAX_SESSIONS));

  try {
    const apiKey = config.TMDB_API_KEY || config.TMDB_ACCESS_TOKEN;
    if (!apiKey) return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });

    const isV3 = apiKey.length === 32 && /^[a-f0-9]+$/i.test(apiKey);
    const headers: Record<string, string> | undefined = !isV3
      ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
      : undefined;
    const extraParams = isV3 ? { api_key: apiKey } : {};

    // Fetch genre map
    const genreRes = await axios.get<TmdbResponse>("https://api.themoviedb.org/3/genre/movie/list", {
      headers,
      params: extraParams
    });
    const genres: Array<{ id: number; name: string }> = (genreRes.data as any).genres || [];
    const genreNameMap = new Map(
      genres.map((g) => [g.id.toString(), g.name])
    );

    let endpoint: string;
    let totalPages: number;
    const params: Record<string, string | number> = { ...extraParams } as Record<string, string | number>;

    if (searchTerm) {
      // Busca por texto — usa search/movie (paginacao normal)
      endpoint = "https://api.themoviedb.org/3/search/movie";
      (params as Record<string, string | number>).query = searchTerm;
      (params as Record<string, string | number>).page = sessionPage;
      totalPages = 500; // search/movie tem ate ~500 paginas
    } else {
      // Catalogo — usa discover/movie com estrategia por faixa
      endpoint = "https://api.themoviedb.org/3/discover/movie";
      const strategy = getDiscoverStrategy(sessionPage);
      Object.assign(params, strategy);
      totalPages = MAX_SESSIONS;
    }

    const res = await axios.get<TmdbResponse>(endpoint, { headers, params });
    const body = res.data;
    const results: TmdbMovie[] = body.results || [];
    const items = results.map((m) => mapMovie(m, genreNameMap));

    // Total results estimado
    const totalResults = searchTerm
      ? (body.total_results || 0)
      : 30000 + (body.total_results || 0);

    return NextResponse.json({
      items,
      totalPages,
      currentPage: sessionPage,
      totalResults,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch catalog");
  }
}

function mapMovie(movie: TmdbMovie, genreMap: Map<string, string>) {
  return {
    Id: movie.id.toString(),
    Name: movie.title,
    Overview: movie.overview,
    Language: movie.original_language,
    ProductionYear: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
    CommunityRating: movie.vote_average,
    ImageTags: {
      Primary: movie.poster_path,
      Backdrop: movie.backdrop_path,
    },
    Genres: movie.genre_ids?.map((id) => genreMap.get(id.toString())).filter(Boolean) || [],
  };
}
