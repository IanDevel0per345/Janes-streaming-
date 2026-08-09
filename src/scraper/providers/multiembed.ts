/**
 * MultiEmbed Provider
 * 
 * Generates embed URLs for MultiEmbed (multiembed.mov).
 * MultiEmbed provides free embed players using TMDB IDs.
 * 
 * URL pattern:
 *   https://multiembed.mov/directstream.php?video_id={tmdb_id}&tmdb=1
 */

import { BaseScraperProvider, ScraperSource } from "../types";
import { logger } from "@/lib/logger";

export class MultiEmbedScraperProvider extends BaseScraperProvider {
  readonly name = "multiembed";
  readonly description = "MultiEmbed provider (multiembed.mov) - generates embed URLs from TMDB IDs";
  readonly enabled = true;

  async scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]> {
    if (!this.enabled) return [];

    const sources: ScraperSource[] = [];
    const tmdbId = movieId;

    try {
      sources.push({
        url: this.normalizeUrl(`https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1`),
        type: "embed",
        quality: "unknown",
        language: "en",
        title: "MultiEmbed",
        provider: this.name,
        movieId: tmdbId,
        movieTitle,
      });

      logger.debug(`MultiEmbed: Generated embed URL for "${movieTitle}" (${tmdbId})`);
    } catch (error) {
      logger.error(`MultiEmbed error for "${movieTitle}" (${tmdbId}): ${error}`);
    }

    return sources;
  }
}
