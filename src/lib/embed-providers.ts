/**
 * Embed Providers Configuration
 * 
 * VidSrc is the primary provider for all movies.
 * Uses ONLY official VidSrc domains from vidsrc.domains to ensure
 * safety and avoid fake/ad-injected clones.
 * 
 * Last verified: Active domains checked via curl (HTTP 200).
 * Official source: https://vidsrc.domains
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
 * Official VidSrc domains (verified active from vidsrc.domains).
 * vidsrc.cc and vidsrc.to are DEAD — do NOT use them.
 */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  // 1. VidSrc2.ru — PRIMARY official domain
  {
    name: "vidsrc2-ru",
    label: "VidSrc",
    priority: 1,
    getUrl: (tmdbId) => `https://vidsrc2.ru/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 2. VidSrcMe.ru — official backup
  {
    name: "vidsrcme-ru",
    label: "VidSrc.me.ru",
    priority: 2,
    getUrl: (tmdbId) => `https://vidsrcme.ru/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 3. VidSrcMe.su — official backup
  {
    name: "vidsrcme-su",
    label: "VidSrc.me.su",
    priority: 3,
    getUrl: (tmdbId) => `https://vidsrcme.su/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 4. VidSrc-Me.ru — official backup
  {
    name: "vidsrc-me-ru",
    label: "VidSrc-Me.ru",
    priority: 4,
    getUrl: (tmdbId) => `https://vidsrc-me.ru/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
  },
  // 5. VidSrc.io — old but still working
  {
    name: "vidsrc-io",
    label: "VidSrc.io",
    priority: 5,
    getUrl: (tmdbId) => `https://vidsrc.io/embed/movie/${tmdbId}`,
    languages: ["dub", "sub", "original"],
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
