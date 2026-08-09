/**
 * Batch Populator - Populate 1000+ movies with embed sources
 * 
 * Fetches movies from TMDB across multiple categories
 * (popular, top_rated, trending, upcoming, now_playing),
 * then generates embed URLs from ALL 4 embed providers
 * (VidSrc, VidLink, 2Embed, MultiEmbed) for each movie,
 * and saves everything to the database.
 * 
 * Usage:
 *   npx tsx src/scraper/batch-populate.ts
 *   npx tsx src/scraper/batch-populate.ts --dry-run
 *   npx tsx src/scraper/batch-populate.ts --limit 2000
 */

import { TmdbScraperProvider } from "./providers/tmdb";
import { VidSrcScraperProvider } from "./providers/vidsrc";
import { VidLinkScraperProvider } from "./providers/vidlink";
import { TwoEmbedScraperProvider } from "./providers/twoembed";
import { MultiEmbedScraperProvider } from "./providers/multiembed";
import { MovieSourceService } from "@/lib/services/movie-source-service";
import { ScraperSource } from "./types";
import { logger } from "@/lib/logger";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.indexOf("--limit");
const TARGET_MOVIES = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : 1200;

// TMDB API credentials
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || "";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

// Embed providers (deterministic URL generation — no API calls needed)
const embedProviders = [
  new VidSrcScraperProvider(),
  new VidLinkScraperProvider(),
  new TwoEmbedScraperProvider(),
  new MultiEmbedScraperProvider(),
];

/** Fetch from TMDB API */
async function fetchTmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${TMDB_API_BASE}/${path.replace(/^\//, "")}`);
  
  if (TMDB_API_KEY) {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
    headers.Authorization = `Bearer ${TMDB_ACCESS_TOKEN}`;
  }

  const res = await fetch(url.toString(), {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`TMDB API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

interface TmdbMovie {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  adult?: boolean;
  imdb_id?: string;
}

/** Fetch movies from a TMDB category across multiple pages */
async function fetchMoviesByCategory(
  category: "popular" | "top_rated" | "upcoming" | "now_playing",
  maxPages: number = 20
): Promise<TmdbMovie[]> {
  const movies: TmdbMovie[] = [];
  const seenIds = new Set<number>();

  for (let page = 1; page <= maxPages; page++) {
    try {
      const data = await fetchTmdb<{ results: TmdbMovie[] }>(`movie/${category}`, {
        page,
        language: "pt-BR",
      });
      for (const m of data.results || []) {
        if (!seenIds.has(m.id) && !m.adult) {
          seenIds.add(m.id);
          movies.push(m);
        }
      }
      // TMDB rate limit: ~40 req/10s → delay every 8 pages
      if (page % 8 === 0) await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`  ✗ ${category} page ${page} failed: ${e}`);
      // On rate limit, wait longer
      if (String(e).includes("429")) await new Promise(r => setTimeout(r, 5000));
    }
  }
  return movies;
}

/** Fetch trending movies */
async function fetchTrending(maxPages: number = 20): Promise<TmdbMovie[]> {
  const movies: TmdbMovie[] = [];
  const seenIds = new Set<number>();

  for (let page = 1; page <= maxPages; page++) {
    try {
      const data = await fetchTmdb<{ results: TmdbMovie[] }>("trending/movie/week", { page });
      for (const m of data.results || []) {
        if (!seenIds.has(m.id) && !m.adult) {
          seenIds.add(m.id);
          movies.push(m);
        }
      }
      if (page % 8 === 0) await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`  ✗ trending page ${page} failed: ${e}`);
      if (String(e).includes("429")) await new Promise(r => setTimeout(r, 5000));
    }
  }
  return movies;
}

/** Generate embed sources from ALL 4 providers for a movie */
async function generateEmbedSources(tmdbId: number, title: string): Promise<ScraperSource[]> {
  const allSources: ScraperSource[] = [];
  const movieIdStr = String(tmdbId);

  for (const provider of embedProviders) {
    try {
      const sources = await provider.scrape(movieIdStr, title);
      allSources.push(...sources);
    } catch (error) {
      console.error(`  ✗ Provider ${provider.name} failed for "${title}": ${error}`);
    }
  }

  return allSources;
}

async function main() {
  console.log("🎬 Janes Streaming - Batch Movie Populator");
  console.log("═".repeat(55));
  console.log(`Target:     ${TARGET_MOVIES} movies minimum`);
  console.log(`Mode:       ${DRY_RUN ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`Providers:  ${embedProviders.map(p => p.name).join(", ")}`);
  console.log("");

  if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
    console.error("❌ TMDB API not configured! Set TMDB_ACCESS_TOKEN or TMDB_API_KEY.");
    process.exit(1);
  }

  // ── Phase 1: Collect movies from TMDB ──────────────────────────────
  console.log("📡 Phase 1: Fetching movies from TMDB...");
  const allMovies = new Map<number, TmdbMovie>();
  const categories = ["popular", "top_rated", "trending", "upcoming", "now_playing"] as const;

  for (const category of categories) {
    console.log(`  → Fetching ${category} movies...`);
    try {
      const movies = category === "trending"
        ? await fetchTrending(25)
        : await fetchMoviesByCategory(category, 25);

      for (const m of movies) {
        allMovies.set(m.id, m);
      }
      console.log(`    ✓ ${movies.length} fetched (total unique: ${allMovies.size})`);
    } catch (error) {
      console.error(`    ✗ ${category} failed: ${error}`);
    }

    if (allMovies.size >= TARGET_MOVIES) break;
    // Brief pause between categories
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Total unique movies collected: ${allMovies.size}`);

  if (allMovies.size === 0) {
    console.error("❌ No movies found. Check your TMDB API credentials.");
    process.exit(1);
  }

  // ── Phase 2: Generate embed URLs and save to DB ────────────────────
  console.log(`\n🔗 Phase 2: Generating embed URLs from all providers...`);
  const movieList = Array.from(allMovies.values());
  let totalSources = 0;
  let moviesWithSources = 0;
  let processed = 0;
  const batchSize = 10;

  for (let i = 0; i < movieList.length; i += batchSize) {
    const batch = movieList.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (movie) => {
        const sources = await generateEmbedSources(movie.id, movie.title);

        if (sources.length > 0 && !DRY_RUN) {
          try {
            const added = await MovieSourceService.addSources(
              sources.map(s => ({
                movieId: s.movieId,
                url: s.url,
                type: s.type,
                quality: s.quality || null,
                language: s.language || null,
                title: s.title || null,
                provider: s.provider,
                status: "active" as const,
                lastCheckedAt: null,
              }))
            );
            return { sources: sources.length, added, hasSources: true };
          } catch (dbError) {
            console.error(`  ✗ DB error for movie ${movie.id}: ${dbError}`);
            return { sources: sources.length, added: 0, hasSources: sources.length > 0 };
          }
        }
        return { sources: sources.length, added: 0, hasSources: sources.length > 0 };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        totalSources += result.value.added || result.value.sources;
        if (result.value.hasSources) moviesWithSources++;
      }
    }

    processed += batch.length;
    if (processed % 100 === 0 || processed === movieList.length) {
      console.log(`  Progress: ${processed}/${movieList.length} movies | ${totalSources} sources saved | ${moviesWithSources} with sources`);
    }

    // Small delay between batches
    if (i + batchSize < movieList.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(55));
  console.log("📊 POPULATION COMPLETE");
  console.log(`  Movies processed:    ${processed}`);
  console.log(`  Movies w/ sources:  ${moviesWithSources}`);
  console.log(`  Total sources saved: ${totalSources}`);
  console.log(`  Avg sources/movie:  ${(totalSources / Math.max(moviesWithSources, 1)).toFixed(1)}`);
  console.log(`  Providers used:     ${embedProviders.map(p => p.name).join(", ")}`);
  if (DRY_RUN) {
    console.log("  (DRY RUN — no data written to database)");
  }
  console.log("");
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
