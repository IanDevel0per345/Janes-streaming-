/**
 * Embed Providers Configuration
 * 
 * VidSrc is the primary provider for all movies.
 * Fallback chain uses only reliable VidSrc variants to avoid ad/popup redirects.
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
 * VidSrc is the primary provider. Only reliable VidSrc variants
 * are used to prevent ad/popup redirects from sketchy hosts.
 */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  // 1. VidSrc.cc — PRIMARY, most reliable, clean player
  {
    name: "vidsrc-cc",
    label: "VidSrc",
    priority: 1,
    getUrl: (tmdbId) => `https://vidsrc.cc/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 2. VidSrc.to — backup VidSrc
  {
    name: "vidsrc-to",
    label: "VidSrc.to",
    priority: 2,
    getUrl: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 3. VidSrc.me — alternate VidSrc
  {
    name: "vidsrc-me",
    label: "VidSrc.me",
    priority: 3,
    getUrl: (tmdbId) => `https://vidsrc.me/embed/tmdb/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 4. VidSrc.xyz — another reliable variant
  {
    name: "vidsrc-xyz",
    label: "VidSrc.xyz",
    priority: 4,
    getUrl: (tmdbId) => `https://vidsrc.xyz/embed/movie/${tmdbId}`,
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
