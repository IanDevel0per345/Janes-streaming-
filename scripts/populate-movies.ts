/**
 * Fast Batch Populator - Fetch 1000+ movies from TMDB
 * Optimized version with concurrent requests and progress reporting
 */
import "dotenv/config";

const TMDB_API_KEY = process.env.TMDB_API_KEY || "44603557faae8f471a17f79bdfb0cbb7";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TARGET = 1200;

interface Movie { id: number; title: string; year?: number; }

async function fetchPage(endpoint: string, page: number): Promise<Movie[]> {
  const url = `${TMDB_BASE}/${endpoint}?api_key=${TMDB_API_KEY}&page=${page}&language=pt-BR`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json() as { results: any[] };
  return (data.results || [])
    .filter((m: any) => !m.adult && m.title)
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? parseInt(m.release_date.substring(0, 4), 10) : undefined,
    }));
}

async function fetchCategory(endpoint: string, maxPages: number): Promise<Movie[]> {
  const movies: Movie[] = [];
  const seen = new Set<number>();
  // Fetch first 5 pages concurrently
  const batchSize = 5;
  for (let start = 1; start <= maxPages; start += batchSize) {
    const pages = Array.from({ length: Math.min(batchSize, maxPages - start + 1) }, (_, i) => start + i);
    const results = await Promise.allSettled(pages.map(p => fetchPage(endpoint, p)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        for (const m of r.value) {
          if (!seen.has(m.id)) { seen.add(m.id); movies.push(m); }
        }
      }
    }
    process.stdout.write(".");
  }
  return movies;
}

async function fetchWatchProviders(movieId: number): Promise<{ url: string; title: string; lang: string }[]> {
  const sources: { url: string; title: string; lang: string }[] = [];
  try {
    const url = `${TMDB_BASE}/movie/${movieId}/watch/providers?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return sources;
    const data = await res.json() as { results?: Record<string, any> };
    if (data.results) {
      for (const region of ["BR", "US"]) {
        const rd = data.results[region];
        if (rd?.link) {
          sources.push({ url: rd.link, title: `TMDB (${region})`, lang: region === "BR" ? "pt-BR" : "en" });
        }
      }
    }
  } catch {}
  // Always add TMDB page
  sources.push({ url: `https://www.themoviedb.org/movie/${movieId}/watch`, title: "TMDB", lang: "en" });
  return sources;
}

async function main() {
  console.log("🎬 Janes Streaming - Fast Movie Populator");
  console.log("═".repeat(50));

  // Phase 1: Collect movies from multiple categories
  const allMovies = new Map<number, Movie>();
  const categories = [
    ["popular", 40],
    ["top_rated", 40],
    ["trending/movie/week", 40],
    ["upcoming", 30],
    ["now_playing", 30],
  ] as const;

  for (const [cat, pages] of categories) {
    process.stdout.write(`  ${cat}: `);
    const movies = await fetchCategory(cat, pages);
    for (const m of movies) allMovies.set(m.id, m);
    console.log(` ${movies.length} found (total: ${allMovies.size})`);
  }

  console.log(`\n📊 Total unique movies: ${allMovies.size}`);

  if (allMovies.size < 100) {
    console.error("❌ Too few movies. Check TMDB API key.");
    process.exit(1);
  }

  // Phase 2: Fetch watch providers and output as JSON
  console.log("\n🔍 Phase 2: Fetching watch providers...");
  const movieList = Array.from(allMovies.values()).slice(0, TARGET);
  const output: Array<{
    movieId: string; title: string; year?: number;
    sources: Array<{ url: string; type: string; quality: string; language: string; title: string; provider: string }>;
  }> = [];

  let processed = 0;
  const batchSize = 8;

  for (let i = 0; i < movieList.length; i += batchSize) {
    const batch = movieList.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (movie) => {
        const sources = await fetchWatchProviders(movie.id);
        return {
          movieId: String(movie.id),
          title: movie.title,
          year: movie.year,
          sources: sources.map(s => ({
            url: s.url,
            type: "embed" as const,
            quality: "unknown" as const,
            language: s.lang,
            title: s.title,
            provider: "tmdb-scraper",
          })),
        };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") output.push(r.value);
    }

    processed += batch.length;
    if (processed % 100 === 0 || processed >= movieList.length) {
      const totalSources = output.reduce((sum, m) => sum + m.sources.length, 0);
      console.log(`  Progress: ${processed}/${movieList.length} movies, ${totalSources} sources`);
    }
  }

  // Write output to JSON file for the app to consume
  const fs = await import("fs/promises");
  const outputPath = "./movie-sources.json";
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  const totalSources = output.reduce((sum, m) => sum + m.sources.length, 0);
  console.log("\n" + "═".repeat(50));
  console.log("📊 POPULATION COMPLETE");
  console.log(`  Movies: ${output.length}`);
  console.log(`  Sources: ${totalSources}`);
  console.log(`  Avg sources/movie: ${(totalSources / output.length).toFixed(1)}`);
  console.log(`  Output: ${outputPath}`);
}

main().catch(console.error);
