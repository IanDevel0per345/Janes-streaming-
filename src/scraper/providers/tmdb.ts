/**
 * TMDB Scraper Provider
 * Fetches movies from TMDB API and creates MovieSource entries
 * with watch provider links for legal streaming platforms.
 */

import { BaseScraperProvider, ScraperSource } from "../types";
import { logger } from "@/lib/logger";

const TMDB_API_BASE = "https://api.themoviedb.org/3";

export class TmdbScraperProvider extends BaseScraperProvider {
  readonly name = "tmdb-scraper";
  readonly description = "TMDB movie scraper - fetches movies and watch provider links";
  readonly enabled = true;

  private accessToken: string;
  private apiKey: string;

  constructor() {
    super();
    this.accessToken = process.env.TMDB_ACCESS_TOKEN || "";
    this.apiKey = process.env.TMDB_API_KEY || "";
  }

  private get isConfigured(): boolean {
    return !!(this.accessToken || this.apiKey);
  }

  /** Check if TMDB credentials are available (public) */
  get configured(): boolean {
    return this.isConfigured;
  }

  private async fetchTmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    if (this.apiKey) {
      const url = new URL(`${TMDB_API_BASE}/${path.replace(/^\//, "")}`);
      url.searchParams.set("api_key", this.apiKey);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`TMDB v3 error: ${res.status}`);
      return res.json() as Promise<T>;
    }

    if (this.accessToken) {
      const url = new URL(`${TMDB_API_BASE}/${path.replace(/^\//, "")}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.accessToken}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`TMDB v4 error: ${res.status}`);
      return res.json() as Promise<T>;
    }

    throw new Error("TMDB not configured");
  }

  async scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]> {
    if (!this.enabled || !this.isConfigured) return [];
    const sources: ScraperSource[] = [];

    try {
      // Get watch providers
      const watchData = await this.fetchTmdb<{ results?: Record<string, { link?: string; flatrate?: Array<{ provider_name: string }>; rent?: Array<{ provider_name: string }>; buy?: Array<{ provider_name: string }> }> }>(
        `/movie/${movieId}/watch/providers`
      );

      if (watchData.results) {
        for (const region of ["BR", "US"]) {
          const rd = watchData.results[region];
          if (rd?.link) {
            sources.push({
              url: rd.link, type: "embed", quality: "unknown",
              language: region === "BR" ? "pt-BR" : "en",
              title: `TMDB Watch (${region})`, provider: this.name,
              movieId: String(movieId), movieTitle,
            });
          }
        }
      }
    } catch (e) {
      logger.debug(`TMDB watch providers failed for ${movieId}: ${e}`);
    }

    // TMDB movie page as fallback source
    sources.push({
      url: `https://www.themoviedb.org/movie/${movieId}/watch`,
      type: "embed", quality: "unknown", language: "en",
      title: "TMDB", provider: this.name,
      movieId: String(movieId), movieTitle,
    });

    return sources;
  }

  /** Bulk fetch movies by category for populating the database */
  async fetchMoviesByCategory(
    category: "popular" | "top_rated" | "upcoming" | "now_playing",
    totalPages: number = 50
  ): Promise<Array<{ id: number; title: string; year?: number }>> {
    const movies: Array<{ id: number; title: string; year?: number }> = [];
    const seenIds = new Set<number>();

    for (let page = 1; page <= totalPages; page++) {
      try {
        const data = await this.fetchTmdb<{ results: Array<{ id: number; title: string; release_date?: string; adult?: boolean }> }>(
          `movie/${category}`, { page, language: "pt-BR" }
        );
        for (const m of data.results || []) {
          if (!seenIds.has(m.id) && !m.adult) {
            seenIds.add(m.id);
            movies.push({ id: m.id, title: m.title, year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : undefined });
          }
        }
        if (page % 10 === 0) await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        logger.debug(`TMDB ${category} page ${page} failed: ${e}`);
      }
    }
    return movies;
  }

  /** Fetch trending movies (week) */
  async fetchTrending(totalPages: number = 50): Promise<Array<{ id: number; title: string; year?: number }>> {
    const movies: Array<{ id: number; title: string; year?: number }> = [];
    const seenIds = new Set<number>();
    for (let page = 1; page <= totalPages; page++) {
      try {
        const data = await this.fetchTmdb<{ results: Array<{ id: number; title: string; release_date?: string; adult?: boolean }> }>(
          "trending/movie/week", { page }
        );
        for (const m of data.results || []) {
          if (!seenIds.has(m.id) && !m.adult) {
            seenIds.add(m.id);
            movies.push({ id: m.id, title: m.title, year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : undefined });
          }
        }
        if (page % 10 === 0) await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        logger.debug(`TMDB trending page ${page} failed: ${e}`);
      }
    }
    return movies;
  }
}
