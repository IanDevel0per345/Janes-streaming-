/**
 * 2Embed Provider
 * 
 * Generates embed URLs for 2Embed (2embed.cc).
 * 2Embed provides free embed players using TMDB IDs.
 * 
 * URL pattern:
 *   https://www.2embed.cc/embed/tmdb/{tmdb_id}
 */

import { BaseScraperProvider, ScraperSource } from "../types";
import { logger } from "@/lib/logger";

export class TwoEmbedScraperProvider extends BaseScraperProvider {
  readonly name = "2embed";
  readonly description = "2Embed provider (2embed.cc) - generates embed URLs from TMDB IDs";
  readonly enabled = true;

  async scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]> {
    if (!this.enabled) return [];

    const sources: ScraperSource[] = [];
    const tmdbId = movieId;

    try {
      sources.push({
        url: this.normalizeUrl(`https://www.2embed.cc/embed/tmdb/${tmdbId}`),
        type: "embed",
        quality: "unknown",
        language: "en",
        title: "2Embed",
        provider: this.name,
        movieId: tmdbId,
        movieTitle,
      });

      logger.debug(`2Embed: Generated embed URL for "${movieTitle}" (${tmdbId})`);
    } catch (error) {
      logger.error(`2Embed error for "${movieTitle}" (${tmdbId}): ${error}`);
    }

    return sources;
  }
}
