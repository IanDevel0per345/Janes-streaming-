import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getSessionOptions } from "@/lib/session";
import { SessionData } from "@/types";
import { config } from "@/lib/config";
import { handleApiError } from "@/lib/api-utils";
import axios from "axios";

const MOVIES_PER_SESSION = 20;
const MAX_SESSIONS = 50; // 50 sessions × 20 = 1000 movies

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, await getSessionOptions());
    if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get("searchTerm") || undefined;
    const sessionPage = parseInt(searchParams.get("session") || "1");
    const tmdbPage = searchTerm ? Math.max(1, sessionPage) : Math.max(1, sessionPage);

    try {
        const apiKey = config.TMDB_API_KEY || config.TMDB_ACCESS_TOKEN;
        if (!apiKey) return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });

        const isV3 = apiKey.length === 32 && /^[a-f0-9]+$/i.test(apiKey);
        const headers = !isV3 ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } : undefined;
        const extraParams = isV3 ? { api_key: apiKey } : {};

        // Fetch genre map
        const genreRes = await axios.get("https://api.themoviedb.org/3/genre/movie/list", {
            headers,
            params: extraParams
        });
        const genreNameMap = new Map(
            genreRes.data.genres.map((g: any) => [g.id.toString(), g.name])
        );

        if (searchTerm) {
            const data = await axios.get("https://api.themoviedb.org/3/search/movie", {
                headers,
                params: { ...extraParams, query: searchTerm, page: tmdbPage }
            });
            const items = data.data.results.map((m: any) => mapMovie(m, genreNameMap));
            const totalPages = Math.min(data.data.total_pages, MAX_SESSIONS);
            return NextResponse.json({ items, totalPages, currentPage: tmdbPage, totalResults: data.data.total_results });
        }

        // Discover by popularity for catalog browsing
        const data = await axios.get("https://api.themoviedb.org/3/discover/movie", {
            headers,
            params: {
                ...extraParams,
                sort_by: "popularity.desc",
                page: tmdbPage,
                "vote_count.gte": 50,
            }
        });

        const items = data.data.results.map((m: any) => mapMovie(m, genreNameMap));
        const totalPages = Math.min(data.data.total_pages, MAX_SESSIONS);

        return NextResponse.json({
            items,
            totalPages,
            currentPage: tmdbPage,
            totalResults: data.data.total_results
        });
    } catch (error) {
        return handleApiError(error, "Failed to fetch catalog");
    }
}

function mapMovie(movie: any, genreMap: Map<string, string>) {
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
        Genres: movie.genre_ids?.map((id: number) => genreMap.get(id.toString())).filter(Boolean) || [],
    };
}
