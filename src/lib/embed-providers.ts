/**
 * Embed Providers Configuration — Jane's Streaming
 * 
 * Multi-provider, multi-content-type embed system.
 * Supports: Movies, TV Series, Anime, Live TV, Sports
 * Each provider has fallback chain with auto-switching.
 */

export type ContentType = "movie" | "series" | "anime" | "live" | "sports";
export type LanguageMode = "dub" | "sub" | "original";

export interface EmbedProvider {
  name: string;
  label: string;
  priority: number;
  /** Supported content types */
  contentTypes: ContentType[];
  /** Supported language modes */
  languages: LanguageMode[];
  /** Generate embed URL for movies */
  getMovieUrl?: (tmdbId: string, lang?: LanguageMode) => string;
  /** Generate embed URL for TV series/anime */
  getTvUrl?: (tmdbId: string, season: number, episode: number, lang?: LanguageMode) => string;
  /** Generate embed URL for live TV */
  getLiveUrl?: (channelId: string) => string;
}

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
 * All embed providers sorted by priority (lower = tried first).
 * Each provider supports different content types.
 */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  // ─── MOVIE + TV PROVIDERS ───────────────────────────────────────
  {
    name: "vidsrc-xyz",
    label: "VidSrc",
    priority: 1,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://vidsrc.xyz/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "vidsrc-cc",
    label: "VidSrc.cc",
    priority: 2,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://vidsrc.cc/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "vidsrc-to",
    label: "VidSrc.to",
    priority: 3,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "vidsrc-icu",
    label: "VidSrc.icu",
    priority: 4,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "autoembed",
    label: "AutoEmbed",
    priority: 5,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://autoembed.cc/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "multiembed",
    label: "MultiEmbed",
    priority: 6,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
    getTvUrl: (id, s, e) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&season=${s}&episode=${e}`,
  },
  {
    name: "embed-su",
    label: "Embed.su",
    priority: 7,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "smashystream",
    label: "SmashyStream",
    priority: 8,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://smashystream.com/play/${id}`,
    getTvUrl: (id, s, e) => `https://smashystream.com/play/${id}/${s}/${e}`,
  },
  {
    name: "2embed",
    label: "2Embed",
    priority: 9,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    getTvUrl: (id, s, e) => `https://www.2embed.cc/embed/${id}/${s}/${e}`,
  },
  {
    name: "vidsrc-pro",
    label: "VidSrc.pro",
    priority: 10,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://vidsrc.pro/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`,
  },
  // ─── BACKUP VIDSRC DOMAINS ─────────────────────────────────────
  {
    name: "vidsrc2-ru",
    label: "VidSrc2",
    priority: 11,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://vidsrc2.ru/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrc2.ru/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: "vidsrcme-ru",
    label: "VidSrc.me",
    priority: 12,
    contentTypes: ["movie", "series", "anime"],
    languages: ["dub", "sub", "original"],
    getMovieUrl: (id) => `https://vidsrcme.ru/embed/movie/${id}`,
    getTvUrl: (id, s, e) => `https://vidsrcme.ru/embed/tv/${id}/${s}/${e}`,
  },
  // ─── LIVE TV / SPORTS PROVIDERS ─────────────────────────────────
  {
    name: "live-streameast",
    label: "StreamEast",
    priority: 1,
    contentTypes: ["live", "sports"],
    languages: ["original"],
    getLiveUrl: (channelId) => `https://streameast.co/${channelId}`,
  },
  {
    name: "live-crackstreams",
    label: "CrackStreams",
    priority: 2,
    contentTypes: ["live", "sports"],
    languages: ["original"],
    getLiveUrl: (channelId) => `https://crackstreams.biz/${channelId}`,
  },
];

/** Get providers that support a given content type and language */
export function getProvidersForContent(
  contentType: ContentType,
  lang: LanguageMode
): EmbedProvider[] {
  return EMBED_PROVIDERS
    .filter((p) => p.contentTypes.includes(contentType) && p.languages.includes(lang))
    .sort((a, b) => a.priority - b.priority);
}

/** Get all providers for a content type (any language) */
export function getProvidersForType(contentType: ContentType): EmbedProvider[] {
  return EMBED_PROVIDERS
    .filter((p) => p.contentTypes.includes(contentType))
    .sort((a, b) => a.priority - b.priority);
}

/** Build embed URL for a movie */
export function getMovieEmbedUrl(tmdbId: string, provider: EmbedProvider): string | null {
  return provider.getMovieUrl?.(tmdbId) ?? null;
}

/** Build embed URL for a TV series episode */
export function getTvEmbedUrl(
  tmdbId: string,
  season: number,
  episode: number,
  provider: EmbedProvider
): string | null {
  return provider.getTvUrl?.(tmdbId, season, episode) ?? null;
}

/** Build embed URL for live TV */
export function getLiveEmbedUrl(channelId: string, provider: EmbedProvider): string | null {
  return provider.getLiveUrl?.(channelId) ?? null;
}

/**
 * Get the full embed chain for a movie (all providers, for fallback).
 */
export function getMovieEmbedChain(
  tmdbId: string,
  lang: LanguageMode
): { url: string; provider: EmbedProvider }[] {
  return getProvidersForContent("movie", lang)
    .map((p) => ({ url: getMovieEmbedUrl(tmdbId, p)!, provider: p }))
    .filter((e) => !!e.url);
}

/**
 * Get the full embed chain for a TV series episode.
 */
export function getTvEmbedChain(
  tmdbId: string,
  season: number,
  episode: number,
  lang: LanguageMode
): { url: string; provider: EmbedProvider }[] {
  return getProvidersForContent("series", lang)
    .map((p) => ({ url: getTvEmbedUrl(tmdbId, season, episode, p)!, provider: p }))
    .filter((e) => !!e.url);
}

/**
 * Get the full embed chain for live TV.
 */
export function getLiveEmbedChain(
  channelId: string
): { url: string; provider: EmbedProvider }[] {
  return getProvidersForType("live")
    .map((p) => ({ url: getLiveEmbedUrl(channelId, p)!, provider: p }))
    .filter((e) => !!e.url);
}

/** Legacy compat — getBestEmbedUrl */
export function getBestEmbedUrl(
  tmdbId: string,
  lang: LanguageMode
): { url: string; provider: EmbedProvider } | null {
  const chain = getMovieEmbedChain(tmdbId, lang);
  return chain[0] || null;
}

/** Legacy compat — getEmbedChain */
export function getEmbedChain(
  tmdbId: string,
  lang: LanguageMode
): { url: string; provider: EmbedProvider }[] {
  return getMovieEmbedChain(tmdbId, lang);
}
