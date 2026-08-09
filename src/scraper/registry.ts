/**
 * Scraper Provider Registry
 * 
 * Manages all available scraper providers.
 * Add new providers by importing them and adding to the registry.
 * 
 * To add a new provider:
 * 1. Create a new file in src/scraper/providers/
 * 2. Implement the BaseScraperProvider interface
 * 3. Import and add it to the PROVIDERS array below
 */

import { ScraperProvider, ScraperSource, ScraperResult, ScraperError } from "./types";
import { ExampleScraperProvider } from "./providers/example";
import { TmdbScraperProvider } from "./providers/tmdb";
import { VidSrcScraperProvider } from "./providers/vidsrc";
import { VidLinkScraperProvider } from "./providers/vidlink";
import { TwoEmbedScraperProvider } from "./providers/twoembed";
import { MultiEmbedScraperProvider } from "./providers/multiembed";
import { logger } from "@/lib/logger";

// Register all scraper providers here
const PROVIDERS: ScraperProvider[] = [
  // Embed providers (generate embed URLs from TMDB IDs)
  new VidSrcScraperProvider(),       // vidsrc.me + vidsrc.cc
  new VidLinkScraperProvider(),      // vidlink.pro
  new TwoEmbedScraperProvider(),     // 2embed.cc
  new MultiEmbedScraperProvider(),   // multiembed.mov
  // TMDB watch providers (legal streaming links)
  new TmdbScraperProvider(),
  // Template (disabled by default)
  new ExampleScraperProvider(),
];

/**
 * Get all registered providers
 */
export function getProviders(): ScraperProvider[] {
  return PROVIDERS;
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(): ScraperProvider[] {
  return PROVIDERS.filter(p => p.enabled);
}

/**
 * Get a specific provider by name
 */
export function getProvider(name: string): ScraperProvider | undefined {
  return PROVIDERS.find(p => p.name === name);
}

/**
 * Scrape sources for a movie from ALL enabled providers
 */
export async function scrapeAll(
  movieId: string,
  movieTitle: string,
  year?: number
): Promise<ScraperResult> {
  const enabledProviders = getEnabledProviders();
  const allSources: ScraperSource[] = [];
  const allErrors: ScraperError[] = [];

  if (enabledProviders.length === 0) {
    logger.debug("No enabled scraper providers");
    return {
      sources: [],
      errors: [],
      provider: "none",
      scrapedAt: new Date().toISOString(),
    };
  }

  for (const provider of enabledProviders) {
    try {
      const sources = await provider.scrape(movieId, movieTitle, year);
      allSources.push(...sources);
      logger.info(`Scraper ${provider.name}: Found ${sources.length} sources for ${movieTitle}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      allErrors.push({
        movieId,
        message: `Provider ${provider.name} failed: ${errorMsg}`,
      });
      logger.error(`Scraper ${provider.name} failed for ${movieTitle}: ${error}`);
    }
  }

  return {
    sources: allSources,
    errors: allErrors,
    provider: enabledProviders.map(p => p.name).join(","),
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Scrape sources for a movie from a SPECIFIC provider
 */
export async function scrapeWithProvider(
  providerName: string,
  movieId: string,
  movieTitle: string,
  year?: number
): Promise<ScraperResult> {
  const provider = getProvider(providerName);
  if (!provider) {
    return {
      sources: [],
      errors: [{ movieId, message: `Provider '${providerName}' not found` }],
      provider: providerName,
      scrapedAt: new Date().toISOString(),
    };
  }

  if (!provider.enabled) {
    return {
      sources: [],
      errors: [{ movieId, message: `Provider '${providerName}' is disabled` }],
      provider: providerName,
      scrapedAt: new Date().toISOString(),
    };
  }

  try {
    const sources = await provider.scrape(movieId, movieTitle, year);
    return {
      sources,
      errors: [],
      provider: providerName,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      sources: [],
      errors: [{ movieId, message: errorMsg }],
      provider: providerName,
      scrapedAt: new Date().toISOString(),
    };
  }
}

/**
 * Validate URLs from a list of sources
 * Returns only valid sources
 */
export async function validateSources(sources: ScraperSource[]): Promise<ScraperSource[]> {
  const valid: ScraperSource[] = [];
  
  for (const source of sources) {
    const provider = getProvider(source.provider);
    if (!provider) {
      valid.push(source); // Keep if no provider to validate with
      continue;
    }

    const validUrl = await provider.validateUrl(source.url);
    if (validUrl) {
      valid.push({ ...source, url: validUrl });
    }
  }

  return valid;
}
