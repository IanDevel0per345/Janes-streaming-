import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { handleApiError } from "@/lib/api-utils";
import axios from "axios";
import { LIVE_CHANNELS, searchChannels, getChannelsByCategory, LiveCategory } from "@/lib/live-channels";

// ── Pagination: 20 items per page, 50,000 pages = 1,000,000 items per content type ──
const ITEMS_PER_PAGE = 20;
const MAX_PAGES = 50000;

// ── TMDB Genre IDs ──
const GENRES: Record<string, number> = {
  action: 28, adventure: 12, animation: 16, comedy: 35,
  crime: 80, documentary: 99, drama: 18, family: 10751,
  fantasy: 14, horror: 27, mystery: 9648, romance: 10749,
  scifi: 878, thriller: 53, war: 10752, western: 37,
};
const GENRE_LIST = Object.values(GENRES);
const GENRE_NAMES = Object.keys(GENRES);

// ── Sort options for variety ──
const SORT_OPTIONS = [
  "popularity.desc", "revenue.desc", "vote_average.desc",
  "release_date.desc", "original_title.asc",
];

// ── TMDB types ──
interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  original_language?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  poster_path?: string;
  backdrop_path?: string;
  genre_ids?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
}

interface TmdbResponse {
  results: TmdbItem[];
  total_pages: number;
  total_results: number;
  page: number;
}

/**
 * Maps a virtual page number (1..50000) to TMDB API parameters.
 * Uses genre × sort × year × vote_count combinations for maximum coverage.
 */
function getMovieStrategy(virtualPage: number): Record<string, string | number> {
  const block = Math.floor((virtualPage - 1) / 500);
 const pageInBlock = ((virtualPage - 1) % 500) + 1;

  // Cycle through genres (0..15), then multi-genre combos (16..31), then years (32..47)
  const phase = block % 48;

  if (phase < 16) {
    // Single genre blocks
    return {
      sort_by: SORT_OPTIONS[phase % SORT_OPTIONS.length],
      with_genres: GENRE_LIST[phase],
      "vote_count.gte": phase < 8 ? 50 : 10,
      page: pageInBlock,
    };
  } else if (phase < 32) {
    // Multi-genre combos
    const g1 = GENRE_LIST[(phase - 16) % GENRE_LIST.length];
    const g2 = GENRE_LIST[((phase - 16) + 3) % GENRE_LIST.length];
    return {
      sort_by: SORT_OPTIONS[(phase - 16) % SORT_OPTIONS.length],
      with_genres: `${g1},${g2}`,
      "vote_count.gte": 5,
      page: pageInBlock,
    };
  } else if (phase < 48) {
    // Year-based blocks (from 2024 going back to 1977)
    const yearIdx = phase - 32;
    const year = 2024 - yearIdx;
    return {
      sort_by: "popularity.desc",
      primary_release_year: year,
      "vote_count.gte": 3,
      page: pageInBlock,
    };
  }

  return { sort_by: "popularity.desc", page: pageInBlock };
}

/**
 * Maps virtual page to TV series strategy.
 */
function getTvStrategy(virtualPage: number): Record<string, string | number> {
  const block = Math.floor((virtualPage - 1) / 500);
  const pageInBlock = ((virtualPage - 1) % 500) + 1;

  const phase = block % 40;

  if (phase < 16) {
    // By genre
    return {
      sort_by: SORT_OPTIONS[phase % SORT_OPTIONS.length],
      with_genres: GENRE_LIST[phase],
      "vote_count.gte": phase < 8 ? 50 : 10,
      page: pageInBlock,
    };
  } else if (phase < 24) {
    // Anime (animation + Japanese)
    return {
      sort_by: SORT_OPTIONS[(phase - 16) % SORT_OPTIONS.length],
      with_genres: 16,
      with_original_language: "ja",
      "vote_count.gte": 5,
      page: pageInBlock,
    };
  } else if (phase < 32) {
    // Korean drama
    return {
      sort_by: "popularity.desc",
      with_original_language: "ko",
      "vote_count.gte": 5,
      page: pageInBlock,
    };
  } else {
    // Year-based
    const year = 2024 - ((phase - 32) % 20);
    return {
      sort_by: "popularity.desc",
      first_air_date_year: year,
      "vote_count.gte": 3,
      page: pageInBlock,
    };
  }
}

/**
 * Anime-specific strategy (wider net — includes non-JP animation).
 */
function getAnimeStrategy(virtualPage: number): Record<string, string | number> {
  const block = Math.floor((virtualPage - 1) / 500);
  const pageInBlock = ((virtualPage - 1) % 500) + 1;

  const phase = block % 10;
  const sorts = ["popularity.desc", "vote_average.desc", "first_air_date.desc"];

  if (phase < 4) {
    // Japanese anime
    return {
      sort_by: sorts[phase % sorts.length],
      with_genres: 16,
      with_original_language: "ja",
      "vote_count.gte": 1,
      page: pageInBlock,
    };
  } else if (phase < 8) {
    // Animation in general
    return {
      sort_by: sorts[(phase - 4) % sorts.length],
      with_genres: 16,
      "vote_count.gte": 1,
      page: pageInBlock,
    };
  } else {
    // Anime movies + series mixed
    return {
      sort_by: sorts[(phase - 8) % sorts.length],
      with_genres: "16,10759", // Animation + Anime genre (if exists)
      "vote_count.gte": 1,
      page: pageInBlock,
    };
  }
}

// ── Cache for genre name map ──
let genreNameCache: Map<string, string> | null = null;
let tvGenreNameCache: Map<string, string> | null = null;

async function getGenreMap(type: "movie" | "tv"): Promise<Map<string, string>> {
  const cache = type === "movie" ? genreNameCache : tvGenreNameCache;
  if (cache) return cache;

  const apiKey = config.TMDB_API_KEY || config.TMDB_ACCESS_TOKEN;
  if (!apiKey) return new Map();
  const isV3 = apiKey.length === 32 && /^[a-f0-9]+$/i.test(apiKey);
  const headers: Record<string, string> | undefined = !isV3
    ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
    : undefined;
  const extraParams = isV3 ? { api_key: apiKey } : {};

  try {
    const res = await axios.get(`https://api.themoviedb.org/3/genre/${type}/list`, {
      headers,
      params: extraParams,
      timeout: 5000,
    });
    const genres: Array<{ id: number; name: string }> = (res.data as any).genres || [];
    const map = new Map(genres.map((g) => [g.id.toString(), g.name]));
    if (type === "movie") genreNameCache = map;
    else tvGenreNameCache = map;
    return map;
  } catch {
    return new Map();
  }
}

function mapMovieItem(item: TmdbItem, genreMap: Map<string, string>) {
  return {
    Id: item.id.toString(),
    Name: item.title || "Unknown",
    Overview: item.overview,
    Language: item.original_language,
    ProductionYear: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
    CommunityRating: item.vote_average,
    ImageTags: {
      Primary: item.poster_path,
      Backdrop: item.backdrop_path,
    },
    Genres: item.genre_ids?.map((id) => genreMap.get(id.toString())).filter(Boolean) || [],
    ContentType: "movie" as const,
  };
}

function mapTvItem(item: TmdbItem, genreMap: Map<string, string>) {
  return {
    Id: item.id.toString(),
    Name: item.name || item.title || "Unknown",
    Overview: item.overview,
    Language: item.original_language,
    ProductionYear: item.first_air_date || item.release_date
      ? new Date(item.first_air_date || item.release_date!).getFullYear()
      : undefined,
    CommunityRating: item.vote_average,
    ImageTags: {
      Primary: item.poster_path,
      Backdrop: item.backdrop_path,
    },
    Genres: item.genre_ids?.map((id) => genreMap.get(id.toString())).filter(Boolean) || [],
    NumberOfSeasons: item.number_of_seasons,
    NumberOfEpisodes: item.number_of_episodes,
    ContentType: item.original_language === "ja" ? "anime" as const : "series" as const,
  };
}

export async function GET(request: NextRequest) {

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "movie") as "movie" | "series" | "anime" | "live" | "sports";
  const page = Math.max(1, Math.min(parseInt(searchParams.get("page") || "1"), MAX_PAGES));
  const searchTerm = searchParams.get("searchTerm") || undefined;
  const category = searchParams.get("category") as LiveCategory | null;

  try {
    // ── LIVE TV / SPORTS ────────────────────────────────────────
    if (type === "live" || type === "sports") {
      let channels = type === "sports"
        ? LIVE_CHANNELS.filter(c => c.category === "esportes")
        : category
          ? getChannelsByCategory(category)
          : LIVE_CHANNELS;

      if (searchTerm) {
        channels = type === "sports"
          ? channels.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.tags.some(t => t.includes(searchTerm.toLowerCase())))
          : searchChannels(searchTerm);
      }

      const totalPages = Math.max(1, Math.ceil(channels.length / ITEMS_PER_PAGE));
      const start = (page - 1) * ITEMS_PER_PAGE;
      const pageChannels = channels.slice(start, start + ITEMS_PER_PAGE);

      const items = pageChannels.map(ch => ({
        Id: `live-${ch.id}`,
        Name: ch.name,
        Overview: ch.description,
        ImageTags: { Primary: ch.logo, Backdrop: null },
        Genres: [ch.category],
        ContentType: "live" as const,
        LiveChannel: ch,
      }));

      return NextResponse.json({
        items,
        totalPages,
        currentPage: page,
        totalResults: channels.length,
        contentType: type,
      });
    }

    // ── TMDB CONTENT (movie / series / anime) ───────────────────
    const apiKey = config.TMDB_API_KEY || config.TMDB_ACCESS_TOKEN;
    if (!apiKey) return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });

    const isV3 = apiKey.length === 32 && /^[a-f0-9]+$/i.test(apiKey);
    const headers: Record<string, string> | undefined = !isV3
      ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
      : undefined;
    const extraParams = isV3 ? { api_key: apiKey } : {};

    let endpoint: string;
    let strategy: Record<string, string | number>;
    let tmdbType: "movie" | "tv";
    let genreMap: Map<string, string>;
    let mapFn: (item: TmdbItem, gm: Map<string, string>) => any;

    if (type === "anime") {
      endpoint = "https://api.themoviedb.org/3/discover/tv";
      tmdbType = "tv";
      genreMap = await getGenreMap("tv");
      mapFn = (item, gm) => {
        const mapped = mapTvItem(item, gm);
        mapped.ContentType = "anime";
        return mapped;
      };
      if (searchTerm) {
        endpoint = "https://api.themoviedb.org/3/search/tv";
        strategy = { ...extraParams, query: searchTerm, page } as Record<string, string | number>;
      } else {
        strategy = { ...extraParams, ...getAnimeStrategy(page) } as Record<string, string | number>;
      }
    } else if (type === "series") {
      endpoint = "https://api.themoviedb.org/3/discover/tv";
      tmdbType = "tv";
      genreMap = await getGenreMap("tv");
      mapFn = mapTvItem;
      if (searchTerm) {
        endpoint = "https://api.themoviedb.org/3/search/tv";
        strategy = { ...extraParams, query: searchTerm, page } as Record<string, string | number>;
      } else {
        strategy = { ...extraParams, ...getTvStrategy(page) } as Record<string, string | number>;
      }
    } else {
      // movie (default)
      endpoint = "https://api.themoviedb.org/3/discover/movie";
      tmdbType = "movie";
      genreMap = await getGenreMap("movie");
      mapFn = mapMovieItem;
      if (searchTerm) {
        endpoint = "https://api.themoviedb.org/3/search/movie";
        strategy = { ...extraParams, query: searchTerm, page } as Record<string, string | number>;
      } else {
        strategy = { ...extraParams, ...getMovieStrategy(page) } as Record<string, string | number>;
      }
    }

    const res = await axios.get<TmdbResponse>(endpoint, {
      headers,
      params: strategy,
      timeout: 10000,
    });

    const body = res.data;
    const results: TmdbItem[] = body.results || [];
    const items = results.map((item) => mapFn(item, genreMap));

    // Total pages depends on whether searching or browsing
    const totalPages = searchTerm
      ? Math.min(body.total_pages || 500, 500)
      : MAX_PAGES;

    const totalResults = searchTerm
      ? (body.total_results || 0)
      : MAX_PAGES * ITEMS_PER_PAGE;

    return NextResponse.json({
      items,
      totalPages,
      currentPage: page,
      totalResults,
      contentType: type,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch catalog");
  }
}
