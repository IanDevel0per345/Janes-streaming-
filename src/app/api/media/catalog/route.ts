import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/session";
import { SessionData } from "@/types";
import { config } from "@/lib/config";
import { handleApiError } from "@/lib/api-utils";
import axios from "axios";

const MAX_SESSIONS = 50; // 50 sessions x 20 = 1000 movies

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

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
    if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get("searchTerm") || undefined;
    const sessionPage = Math.max(1, parseInt(searchParams.get("session") || "1"));

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
        const params: Record<string, string | number> = { ...extraParams, page: sessionPage } as Record<string, string | number>;

        if (searchTerm) {
            endpoint = "https://api.themoviedb.org/3/search/movie";
            (params as Record<string, string | number>).query = searchTerm;
        } else {
            endpoint = "https://api.themoviedb.org/3/discover/movie";
            (params as Record<string, string | number>).sort_by = "popularity.desc";
            (params as Record<string, string | number>)["vote_count.gte"] = 50;
        }

        const res = await axios.get<TmdbResponse>(endpoint, { headers, params });
        const body = res.data;
        const results: TmdbMovie[] = body.results || [];
        const items = results.map((m) => mapMovie(m, genreNameMap));
        const totalPages = Math.min(body.total_pages || 1, MAX_SESSIONS);

        return NextResponse.json({
            items,
            totalPages,
            currentPage: body.page || sessionPage,
            totalResults: body.total_results || 0
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
