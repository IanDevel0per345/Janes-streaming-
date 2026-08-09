/**
 * VidSrc Embed Provider
 * 
 * Generates embed URLs for VidSrc (vidsrc.me and vidsrc.cc).
 * VidSrc provides free embed players using TMDB IDs.
 * 
 * URL patterns:
 *   vidsrc.me: https://vidsrc.me/embed/tmdb/{tmdb_id}
 *   vidsrc.cc: https://vidsrc.cc/v2/embed/movie/{tmdb_id}
 */

import { BaseScraperProvider, ScraperSource } from "../types";
import { logger } from "@/lib/logger";

export class VidSrcScraperProvider extends BaseScraperProvider {
  readonly name = "vidsrc";
  readonly description = "VidSrc embed provider (vidsrc.me / vidsrc.cc) - generates embed URLs from TMDB IDs";
  readonly enabled = true;

  async scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]> {
    if (!this.enabled) return [];

    const sources: ScraperSource[] = [];
    const tmdbId = movieId;

    try {
      // VidSrc.me — primary
      sources.push({
        url: this.normalizeUrl(`https://vidsrc.me/embed/tmdb/${tmdbId}`),
        type: "embed",
        quality: "unknown",
        language: "en",
        title: "VidSrc.me",
        provider: this.name,
        movieId: tmdbId,
        movieTitle,
      });

      // VidSrc.cc — alternative/fallback
      sources.push({
        url: this.normalizeUrl(`https://vidsrc.cc/v2/embed/movie/${tmdbId}`),
        type: "embed",
        quality: "unknown",
        language: "en",
        title: "VidSrc.cc",
        provider: this.name,
        movieId: tmdbId,
        movieTitle,
      });

      logger.debug(`VidSrc: Generated ${sources.length} embed URLs for "${movieTitle}" (${tmdbId})`);
    } catch (error) {
      logger.error(`VidSrc error for "${movieTitle}" (${tmdbId}): ${error}`);
    }

    return sources;
  }
}
