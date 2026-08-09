/**
 * Scraper Module - Barrel Export
 * 
 * Modular scraper system for collecting authorized embed URLs.
 * 
 * Usage:
 *   import { scrapeMovie, scrapeAll, getEnabledProviders } from "@/scraper";
 * 
 * Adding new providers:
 *   1. Create a file in src/scraper/providers/
 *   2. Extend BaseScraperProvider from ./types
 *   3. Add the provider to the PROVIDERS array in ./registry.ts
 */

export { scrapeMovie, scrapeAllMovies } from "./run";
export { scrapeAll, scrapeWithProvider, getEnabledProviders, getProviders, getProvider, validateSources } from "./registry";
export type { ScraperSource, ScraperResult, ScraperError, ScraperProvider } from "./types";
export { BaseScraperProvider } from "./types";
