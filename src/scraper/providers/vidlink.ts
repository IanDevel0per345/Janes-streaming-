/**
 * VidLink Embed Provider
 * 
 * Generates embed URLs for VidLink (vidlink.pro).
 * VidLink provides free embed players using TMDB IDs.
 * 
 * URL pattern:
 *   https://vidlink.pro/movie/tmdb/{tmdb_id}
 */

import { BaseScraperProvider, ScraperSource } from "../types";
import { logger } from "@/lib/logger";

export class VidLinkScraperProvider extends BaseScraperProvider {
  readonly name = "vidlink";
  readonly description = "VidLink embed provider (vidlink.pro) - generates embed URLs from TMDB IDs";
  readonly enabled = true;

  async scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]> {
    if (!this.enabled) return [];

    const sources: ScraperSource[] = [];
    const tmdbId = movieId;

    try {
      sources.push({
        url: this.normalizeUrl(`https://vidlink.pro/movie/tmdb/${tmdbId}`),
        type: "embed",
        quality: "unknown",
        language: "en",
        title: "VidLink",
        provider: this.name,
        movieId: tmdbId,
        movieTitle,
      });

      logger.debug(`VidLink: Generated embed URL for "${movieTitle}" (${tmdbId})`);
    } catch (error) {
      logger.error(`VidLink error for "${movieTitle}" (${tmdbId}): ${error}`);
    }

    return sources;
  }
}
