/**
 * Fast Batch Populator - Populate 1000+ movies with embed sources
 * Optimized for speed: fewer API calls, parallel fetching, direct DB writes.
 * 
 * Usage:
 *   npx tsx src/scraper/batch-populate.ts
 *   npx tsx src/scraper/batch-populate.ts --dry-run
 */

import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
// Load .env.local explicitly
dotenvConfig({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@libsql/client";

const DRY_RUN = process.argv.includes("--dry-run");

// TMDB API
const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || "";
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const DB_URL = process.env.DATABASE_URL || "file:janes-streaming.db";
// Resolve relative DB paths to absolute
const resolvedDbUrl = DB_URL.startsWith("file:") && !DB_URL.startsWith("file:/")
  ? `file:${resolve(process.cwd(), DB_URL.replace("file:", ""))}`
  : DB_URL;

// Embed URL patterns (deterministic — no API calls needed)
const EMBED_PROVIDERS = [
  { name: "vidsrc-me", title: "VidSrc.me", buildUrl: (id: string) => `https://vidsrc.me/embed/tmdb/${id}` },
  { name: "vidsrc-cc", title: "VidSrc.cc", buildUrl: (id: string) => `https://vidsrc.cc/v2/embed/movie/${id}` },
  { name: "vidlink", title: "VidLink", buildUrl: (id: string) => `https://vidlink.pro/movie/tmdb/${id}` },
  { name: "2embed", title: "2Embed", buildUrl: (id: string) => `https://www.2embed.cc/embed/tmdb/${id}` },
  { name: "multiembed", title: "MultiEmbed", buildUrl: (id: string) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1` },
];

async function fetchTmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(`${TMDB_API_BASE}/${path.replace(/^\//, "")}`);
  if (TMDB_API_KEY) url.searchParams.set("api_key", TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { Accept: "application/json" };
  if (TMDB_ACCESS_TOKEN && !TMDB_API_KEY) headers.Authorization = `Bearer ${TMDB_ACCESS_TOKEN}`;

  const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (res.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(`TMDB ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface Movie { id: number; title: string; release_date?: string; }

/** Fetch all movies from a category using parallel page fetching */
async function fetchCategory(category: string, maxPages: number): Promise<Movie[]> {
  const movies: Movie[] = [];
  const seen = new Set<number>();

  // Fetch pages in small parallel batches
  for (let batch = 0; batch < Math.ceil(maxPages / 4); batch++) {
    const pageStart = batch * 4 + 1;
    const pageEnd = Math.min(pageStart + 3, maxPages);
    const promises = [];

    for (let page = pageStart; page <= pageEnd; page++) {
      const path = category === "trending" ? "trending/movie/week" : `movie/${category}`;
      promises.push(
        fetchTmdb<{ results: Movie[] }>(path, { page, language: "pt-BR" })
          .then(data => {
            for (const m of data.results || []) {
              if (!seen.has(m.id)) { seen.add(m.id); movies.push(m); }
            }
          })
          .catch(e => { if (String(e).includes("RATE_LIMITED")) throw e; })
      );
    }

    try {
      await Promise.all(promises);
    } catch {
      // On rate limit, wait and retry this batch
      await new Promise(r => setTimeout(r, 3000));
      try { await Promise.all(promises); } catch { /* skip */ }
    }

    // Brief pause between batches for rate limiting
    await new Promise(r => setTimeout(r, 600));
  }

  return movies;
}

async function main() {
  console.log("🎬 Janes Streaming - Batch Movie Populator (Fast)");
  console.log("═".repeat(55));
  console.log(`Mode:       ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Providers:  ${EMBED_PROVIDERS.map(p => p.name).join(", ")}`);
  console.log("");

  if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
    console.error("❌ TMDB API not configured!");
    process.exit(1);
  }

  // ── Phase 1: Collect movies ──
  console.log("📡 Phase 1: Fetching movies from TMDB...");
  const allMovies = new Map<number, Movie>();
  const categories = ["popular", "top_rated", "trending", "upcoming", "now_playing"];
  const pagesPerCat = 20; // 20 pages * 20 results = 400 per category

  for (const cat of categories) {
    process.stdout.write(`  → ${cat}: `);
    try {
      const movies = await fetchCategory(cat, pagesPerCat);
      for (const m of movies) allMovies.set(m.id, m);
      console.log(`${movies.length} fetched (total: ${allMovies.size})`);
    } catch (e) {
      console.error(`failed: ${e}`);
    }
    if (allMovies.size >= 1200) break;
  }

  console.log(`\n📊 Unique movies: ${allMovies.size}`);
  if (allMovies.size < 100) {
    console.error("❌ Too few movies. Check TMDB credentials.");
    process.exit(1);
  }

  if (DRY_RUN) {
    // Just show what would be generated
    const sample = Array.from(allMovies.values()).slice(0, 3);
    for (const m of sample) {
      console.log(`\n  "${m.title}" (TMDB: ${m.id}):`);
      for (const p of EMBED_PROVIDERS) {
        console.log(`    ${p.name}: ${p.buildUrl(String(m.id))}`);
      }
    }
    console.log(`\n  Would generate ${allMovies.size * EMBED_PROVIDERS.length} total sources.`);
    return;
  }

  // ── Phase 2: Insert into database ──
  console.log(`\n💾 Phase 2: Saving ${allMovies.size * EMBED_PROVIDERS.length} embed sources to DB...`);

  // Connect directly to the database
  const client = createClient({ url: resolvedDbUrl });
  
  let totalInserted = 0;
  let duplicates = 0;
  const movieList = Array.from(allMovies.values());
  const batchSize = 50;

  for (let i = 0; i < movieList.length; i += batchSize) {
    const batch = movieList.slice(i, i + batchSize);
    
    // Build all INSERT statements for this batch
    const values: string[] = [];
    for (const movie of batch) {
      const movieId = String(movie.id);
      for (const provider of EMBED_PROVIDERS) {
        const url = provider.buildUrl(movieId);
        const title = provider.title.replace("'", "''");
        const providerName = provider.name;
        values.push(`('${movieId}', '${url}', 'embed', 'unknown', 'en', '${title}', '${providerName}', 'active')`);
      }
    }

    // Batch insert with INSERT OR IGNORE to skip duplicates
    try {
      const sql = `INSERT OR IGNORE INTO MovieSource (movieId, url, type, quality, language, title, provider, status) VALUES ${values.join(", ")}`;
      const result = await client.execute(sql);
      totalInserted += Number(result.rowsAffected || 0);
      duplicates += (batch.length * EMBED_PROVIDERS.length) - Number(result.rowsAffected || 0);
    } catch (dbError) {
      // If the table doesn't exist yet, create it
      if (String(dbError).includes("no such table")) {
        console.log("  Creating MovieSource table...");
        await client.execute(`
          CREATE TABLE IF NOT EXISTS MovieSource (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movieId TEXT NOT NULL,
            url TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'embed',
            quality TEXT,
            language TEXT,
            title TEXT,
            provider TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            addedAt TEXT NOT NULL DEFAULT (datetime('now')),
            lastCheckedAt TEXT
          )
        `);
        await client.execute(`CREATE INDEX IF NOT EXISTS MovieSource_movieId_idx ON MovieSource(movieId)`);
        await client.execute(`CREATE INDEX IF NOT EXISTS MovieSource_provider_idx ON MovieSource(provider)`);
        await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS MovieSource_movieId_url_key ON MovieSource(movieId, url)`);
        
        // Retry
        const sql = `INSERT OR IGNORE INTO MovieSource (movieId, url, type, quality, language, title, provider, status) VALUES ${values.join(", ")}`;
        const result = await client.execute(sql);
        totalInserted += Number(result.rowsAffected || 0);
      } else {
        console.error(`  ✗ DB error: ${dbError}`);
      }
    }

    const processed = Math.min(i + batchSize, movieList.length);
    if (processed % 200 === 0 || processed === movieList.length) {
      console.log(`  Progress: ${processed}/${movieList.length} movies | ${totalInserted} sources inserted`);
    }
  }

  // ── Summary ──
  console.log("\n" + "═".repeat(55));
  console.log("📊 POPULATION COMPLETE");
  console.log(`  Movies:            ${allMovies.size}`);
  console.log(`  Sources inserted:  ${totalInserted}`);
  console.log(`  Duplicates skipped: ${duplicates}`);
  console.log(`  Sources/movie:     ${EMBED_PROVIDERS.length} (${EMBED_PROVIDERS.map(p => p.name).join(", ")})`);
  console.log("");

  // Verify count
  try {
    const countResult = await client.execute("SELECT COUNT(*) as total FROM MovieSource");
    const movieCountResult = await client.execute("SELECT COUNT(DISTINCT movieId) as total FROM MovieSource");
    console.log(`  DB verification: ${countResult.rows[0]?.total} total sources, ${movieCountResult.rows[0]?.total} unique movies`);
  } catch { }

  client.close();
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
