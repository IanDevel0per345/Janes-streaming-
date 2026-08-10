/**
 * Embed Providers Configuration
 * 
 * All streaming embed sources with priority order.
 * The system auto-selects the best active source based on language preference.
 * Users choose language (dubbed/subbed), NOT the player.
 */

export interface EmbedProvider {
  name: string;
  label: string;
  /** Priority: lower = tried first */
  priority: number;
  /** Generates embed URL from TMDB ID */
  getUrl: (tmdbId: string) => string;
  /** Supported language modes */
  languages: LanguageMode[];
}

export type LanguageMode = "dub" | "sub" | "original";

export interface LanguageOption {
  id: LanguageMode;
  label: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: "dub", label: "Dublado", flag: "🇧🇷" },
  { id: "sub", label: "Legendado", flag: "🇺🇸" },
  { id: "original", label: "Original", flag: "🌍" },
];

/**
 * Complete provider list in priority order.
 * Most reliable providers first.
 */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  // 1. 2Embed (2embed.cc) — very reliable, has Portuguese content
  {
    name: "2embed",
    label: "2Embed",
    priority: 1,
    getUrl: (tmdbId) => `https://www.2embed.cc/embed/tmdb/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 2. VidSrc (vidsrc.me) — reliable alternative
  {
    name: "vidsrc-me",
    label: "VidSrc.me",
    priority: 2,
    getUrl: (tmdbId) => `https://vidsrc.me/embed/tmdb/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 3. VidSrc (vidsrc.to) — kept as option
  {
    name: "vidsrc-to",
    label: "VidSrc",
    priority: 3,
    getUrl: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 4. AutoEmbed
  {
    name: "autoembed",
    label: "AutoEmbed",
    priority: 4,
    getUrl: (tmdbId) => `https://autoembed.cc/embed/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 5. Vidsrc.xyz (Embedder)
  {
    name: "vidsrc-xyz",
    label: "VidSrc.xyz",
    priority: 5,
    getUrl: (tmdbId) => `https://vidsrc.xyz/embed/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 6. MultiEmbed
  {
    name: "multiembed",
    label: "MultiEmbed",
    priority: 6,
    getUrl: (tmdbId) => `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1`,
    languages: ["dub", "sub"],
  },
  // 7. Gomo.to
  {
    name: "gomo",
    label: "Gomo",
    priority: 7,
    getUrl: (tmdbId) => `https://gomo.to/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 8. MovieAPI
  {
    name: "movieapi",
    label: "MovieAPI",
    priority: 8,
    getUrl: (tmdbId) => `https://movieapi.to/embed/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 9. Smashystream
  {
    name: "smashystream",
    label: "Smashystream",
    priority: 9,
    getUrl: (tmdbId) => `https://smashystream.com/play/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 10. SimpleEmbed
  {
    name: "simpleembed",
    label: "SimpleEmbed",
    priority: 10,
    getUrl: (tmdbId) => `https://simpleembed.to/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 11. Driveembed
  {
    name: "driveembed",
    label: "Driveembed",
    priority: 11,
    getUrl: (tmdbId) => `https://driveembed.xyz/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 12. StreamHide
  {
    name: "streamhide",
    label: "StreamHide",
    priority: 12,
    getUrl: (tmdbId) => `https://streamhide.to/embed/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 13. Hydrax
  {
    name: "hydrax",
    label: "Hydrax",
    priority: 13,
    getUrl: (tmdbId) => `https://player.hydrax.app/watch/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 14. BestEmbed
  {
    name: "bestembed",
    label: "BestEmbed",
    priority: 14,
    getUrl: (tmdbId) => `https://bestembed.xyz/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
  // 15. UltraEmbed
  {
    name: "ultraembed",
    label: "UltraEmbed",
    priority: 15,
    getUrl: (tmdbId) => `https://ultraembed.to/movie/${tmdbId}`,
    languages: ["dub", "sub"],
  },
];

/**
 * Get all providers that support a given language, sorted by priority.
 */
export function getProvidersForLanguage(lang: LanguageMode): EmbedProvider[] {
  return EMBED_PROVIDERS
    .filter(p => p.languages.includes(lang))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get the first (best) provider URL for a given TMDB ID and language.
 */
export function getBestEmbedUrl(tmdbId: string, lang: LanguageMode): { url: string; provider: EmbedProvider } | null {
  const providers = getProvidersForLanguage(lang);
  if (providers.length === 0) return null;
  const best = providers[0];
  return { url: best.getUrl(tmdbId), provider: best };
}

/**
 * Get all embed URLs for a given TMDB ID and language (for fallback chain).
 */
export function getEmbedChain(tmdbId: string, lang: LanguageMode): { url: string; provider: EmbedProvider }[] {
  return getProvidersForLanguage(lang).map(p => ({
    url: p.getUrl(tmdbId),
    provider: p,
  }));
}
