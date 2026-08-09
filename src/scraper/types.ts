/**
 * Scraper Types and Base Interface
 * 
 * Each scraper provider implements this interface to collect
 * authorized public embed URLs for movies.
 * 
 * IMPORTANT: Scrapers must ONLY access public, authorized sources.
 * They must NOT bypass DRM, authentication, paywalls, anti-bot systems,
 * or any mechanism designed to prevent content extraction.
 */

export interface ScraperSource {
  /** The embed/playback URL */
  url: string;
  /** Type of source: "embed" (iframe), "direct" (video URL), "hls" (m3u8), "dash" (mpd) */
  type: "embed" | "direct" | "hls" | "dash";
  /** Quality label: "720p", "1080p", "4k", "unknown" */
  quality: string;
  /** Language tag: "pt-BR", "en", "es" */
  language: string;
  /** Display title for this source */
  title: string;
  /** Name of the scraper provider that found this source */
  provider: string;
  /** Movie ID this source is associated with (provider's external ID or IMDb ID) */
  movieId: string;
  /** Movie title (for reference) */
  movieTitle?: string;
}

export interface ScraperResult {
  /** Successfully found sources */
  sources: ScraperSource[];
  /** Errors encountered during scraping */
  errors: ScraperError[];
  /** Provider name */
  provider: string;
  /** Timestamp */
  scrapedAt: string;
}

export interface ScraperError {
  movieId: string;
  message: string;
  url?: string;
}

export interface ScraperProvider {
  /** Unique name for this scraper provider */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** Whether this provider is enabled */
  readonly enabled: boolean;

  /**
   * Scrape sources for a specific movie
   * @param movieId - The movie's external ID or IMDb ID
   * @param movieTitle - The movie title (for search-based scrapers)
   * @param year - Optional production year for better matching
   */
  scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]>;

  /**
   * Validate that a URL is still accessible
   * Returns the URL if valid, null if broken
   */
  validateUrl(url: string): Promise<string | null>;

  /**
   * Normalize a URL to a standard format
   */
  normalizeUrl(url: string): string;
}

/**
 * Abstract base class for scraper providers
 * Provides common URL validation and normalization
 */
export abstract class BaseScraperProvider implements ScraperProvider {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly enabled: boolean;

  abstract scrape(movieId: string, movieTitle: string, year?: number): Promise<ScraperSource[]>;

  async validateUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      return response.ok ? url : null;
    } catch {
      return null;
    }
  }

  normalizeUrl(url: string): string {
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = `https://${normalized}`;
    }
    if (normalized.length > 8 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
}
