/**
 * Scraper CLI and Batch Runner
 * 
 * Run from command line:
 *   npx tsx src/scraper/run.ts --movie "Inception" --id tt1375666 --year 2010
 *   npx tsx src/scraper/run.ts --all   (scrape for all movies with sources in DB)
 *   npx tsx src/scraper/run.ts --provider example --movie "The Matrix"
 */

import { scrapeAll, scrapeWithProvider, getEnabledProviders } from "./registry";
import { MovieSourceService } from "@/lib/services/movie-source-service";
import { logger } from "@/lib/logger";

interface ScrapeOptions {
  movieId: string;
  movieTitle: string;
  year?: number;
  provider?: string;
  /** If true, save found sources to the database */
  saveToDb?: boolean;
}

/**
 * Run the scraper for a single movie
 */
export async function scrapeMovie(options: ScrapeOptions) {
  const { movieId, movieTitle, year, provider, saveToDb = true } = options;

  logger.info(`Scraping sources for: ${movieTitle} (${movieId})${year ? ` [${year}]` : ""}`);

  const result = provider
    ? await scrapeWithProvider(provider, movieId, movieTitle, year)
    : await scrapeAll(movieId, movieTitle, year);

  logger.info(`Found ${result.sources.length} sources, ${result.errors.length} errors`);

  if (result.sources.length > 0) {
    for (const source of result.sources) {
      logger.info(`  → [${source.provider}] ${source.type} ${source.quality || ""} ${source.language || ""} ${source.url}`);
    }
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      logger.error(`  ✗ ${error.message}`);
    }
  }

  // Save to database if requested
  if (saveToDb && result.sources.length > 0) {
    const added = await MovieSourceService.addSources(
      result.sources.map(s => ({
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
    logger.info(`Saved ${added} sources to database`);
  }

  return result;
}

/**
 * Run the scraper for all movies that have sources in the DB (re-scrape)
 */
export async function scrapeAllMovies() {
  const providers = getEnabledProviders();
  if (providers.length === 0) {
    logger.info("No enabled scraper providers. Exiting.");
    return;
  }

  logger.info(`Running scraper with ${providers.length} enabled providers: ${providers.map(p => p.name).join(", ")}`);
  logger.info("Note: This requires a list of movies to scrape. Implement your movie list source here.");
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Janes Streaming Scraper
=======================

Usage:
  npx tsx src/scraper/run.ts --movie "Title" --id MOVIE_ID [--year 2024] [--provider name]
  npx tsx src/scraper/run.ts --all

Options:
  --movie "Title"    Movie title to search for
  --id MOVIE_ID      Movie ID (IMDb ID or provider ID)
  --year YYYY        Production year (optional, for better matching)
  --provider name    Use specific scraper provider (optional)
  --all              Scrape for all movies in database
  --dry-run          Find sources but don't save to database

Available providers:
${getEnabledProviders().map(p => `  - ${p.name}: ${p.description}`).join("\n") || "  (none enabled)"}
    `);
    process.exit(0);
  }

  const movieTitle = args[args.indexOf("--movie") + 1];
  const movieId = args[args.indexOf("--id") + 1];
  const yearIndex = args.indexOf("--year");
  const year = yearIndex !== -1 ? parseInt(args[yearIndex + 1], 10) : undefined;
  const providerIndex = args.indexOf("--provider");
  const provider = providerIndex !== -1 ? args[providerIndex + 1] : undefined;
  const dryRun = args.includes("--dry-run");
  const scrapeAllFlag = args.includes("--all");

  if (scrapeAllFlag) {
    await scrapeAllMovies();
  } else if (movieTitle && movieId) {
    await scrapeMovie({
      movieId,
      movieTitle,
      year,
      provider,
      saveToDb: !dryRun,
    });
  } else {
    console.error("Error: Provide --movie and --id, or --all");
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
