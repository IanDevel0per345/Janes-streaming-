/**
 * Movie Sources Service
 * Manages authorized playback/embed URLs for movies
 */

import { eq, and } from "drizzle-orm";
import { db, movieSources } from "@/lib/db";
import type { MovieSource, NewMovieSource } from "@/db/schema";
import { logger } from "@/lib/logger";

export class MovieSourceService {
  /**
   * Get all active sources for a movie
   */
  static async getSourcesForMovie(movieId: string): Promise<MovieSource[]> {
    try {
      return await db
        .select()
        .from(movieSources)
        .where(and(
          eq(movieSources.movieId, movieId),
          eq(movieSources.status, "active")
        ));
    } catch (error) {
      logger.error(`Failed to get sources for movie ${movieId}: ${error}`);
      return [];
    }
  }

  /**
   * Get all sources for a movie (including inactive/broken)
   */
  static async getAllSourcesForMovie(movieId: string): Promise<MovieSource[]> {
    try {
      return await db
        .select()
        .from(movieSources)
        .where(eq(movieSources.movieId, movieId));
    } catch (error) {
      logger.error(`Failed to get all sources for movie ${movieId}: ${error}`);
      return [];
    }
  }

  /**
   * Add a new source for a movie
   * Validates the URL and normalizes it
   */
  static async addSource(source: Omit<NewMovieSource, "id" | "addedAt">): Promise<MovieSource | null> {
    try {
      const normalizedUrl = this.normalizeUrl(source.url);
      if (!this.isValidUrl(normalizedUrl)) {
        logger.error(`Invalid URL for movie source: ${source.url}`);
        return null;
      }

      // Check for duplicate
      const existing = await db
        .select()
        .from(movieSources)
        .where(and(
          eq(movieSources.movieId, source.movieId),
          eq(movieSources.url, normalizedUrl)
        ))
        .limit(1);

      if (existing.length > 0) {
        logger.debug(`Source already exists for movie ${source.movieId}: ${normalizedUrl}`);
        return existing[0];
      }

      const result = await db
        .insert(movieSources)
        .values({
          ...source,
          url: normalizedUrl,
        })
        .returning();

      return result[0] || null;
    } catch (error) {
      logger.error(`Failed to add source for movie ${source.movieId}: ${error}`);
      return null;
    }
  }

  /**
   * Add multiple sources at once (batch insert)
   */
  static async addSources(sources: Omit<NewMovieSource, "id" | "addedAt">[]): Promise<number> {
    let added = 0;
    for (const source of sources) {
      const result = await this.addSource(source);
      if (result) added++;
    }
    return added;
  }

  /**
   * Update a source's status
   */
  static async updateSourceStatus(id: number, status: "active" | "inactive" | "broken"): Promise<boolean> {
    try {
      await db
        .update(movieSources)
        .set({ status, lastCheckedAt: new Date().toISOString() })
        .where(eq(movieSources.id, id));
      return true;
    } catch (error) {
      logger.error(`Failed to update source ${id}: ${error}`);
      return false;
    }
  }

  /**
   * Mark a source as checked (update lastCheckedAt)
   */
  static async markChecked(id: number, status?: "active" | "inactive" | "broken"): Promise<void> {
    try {
      await db
        .update(movieSources)
        .set({
          lastCheckedAt: new Date().toISOString(),
          ...(status ? { status } : {}),
        })
        .where(eq(movieSources.id, id));
    } catch (error) {
      logger.error(`Failed to mark source ${id} as checked: ${error}`);
    }
  }

  /**
   * Delete a source
   */
  static async deleteSource(id: number): Promise<boolean> {
    try {
      await db.delete(movieSources).where(eq(movieSources.id, id));
      return true;
    } catch (error) {
      logger.error(`Failed to delete source ${id}: ${error}`);
      return false;
    }
  }

  /**
   * Delete all sources for a movie
   */
  static async deleteSourcesForMovie(movieId: string): Promise<boolean> {
    try {
      await db.delete(movieSources).where(eq(movieSources.movieId, movieId));
      return true;
    } catch (error) {
      logger.error(`Failed to delete sources for movie ${movieId}: ${error}`);
      return false;
    }
  }

  /**
   * Get all sources by provider
   */
  static async getSourcesByProvider(provider: string): Promise<MovieSource[]> {
    try {
      return await db
        .select()
        .from(movieSources)
        .where(eq(movieSources.provider, provider));
    } catch (error) {
      logger.error(`Failed to get sources for provider ${provider}: ${error}`);
      return [];
    }
  }

  /**
   * Validate a URL
   */
  static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Normalize a URL (trim, ensure protocol, remove trailing slash)
   */
  static normalizeUrl(url: string): string {
    let normalized = url.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = `https://${normalized}`;
    }
    // Remove trailing slash except for domain-only URLs
    if (normalized.length > 8 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
}
