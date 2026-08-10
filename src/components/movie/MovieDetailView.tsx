"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play, Clock, Star, HeartOff, Bookmark, ShieldCheck, X, AlertCircle,
  Loader2, Maximize, MonitorSmartphone, Tv, Tv2, Cast,
  Volume2, ChevronDown, ChevronRight, Pause, Square, VolumeX, RefreshCw,
  Radio, Sparkles
} from "lucide-react";
import { UserAvatarList } from "../session/UserAvatarList";
import { useQuery } from "@tanstack/react-query";
import { MediaItem, WatchProvider } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Drawer, DrawerContent, DrawerTitle } from "../ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { useSession } from "@/hooks/api";
import { ticksToTime, cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { useMovieActions } from "@/hooks/use-movie-actions";
import { QUERY_KEYS } from "@/hooks/api/query-keys";
import { getLanguageLabel } from "@/lib/language";
import { getProviderDetailsUrl } from "@/lib/provider-links";
import { ProviderType } from "@/lib/providers/types";
import {
  ContentType, LanguageMode,
  LANGUAGE_OPTIONS,
  getMovieEmbedChain, getTvEmbedChain, getLiveEmbedChain,
} from "@/lib/embed-providers";
import { LiveChannel } from "@/lib/live-channels";

interface Props {
  movieId: string | null;
  onClose: () => void;
  showLikedBy?: boolean;
  sessionCode?: string | null;
  contentType?: ContentType;
  liveChannel?: LiveChannel;
}

// ─── DLNA Device Type ──────────────────────────────────────────
interface DlnaDevice {
  friendlyName: string;
  manufacturer: string;
  modelName: string;
  location: string;
  avTransportUrl?: string;
}

export function MovieDetailView({
  movieId, onClose, showLikedBy = true, sessionCode,
  contentType: incomingContentType, liveChannel,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLang, setSelectedLang] = useState<LanguageMode>("dub");
  const [chainIndex, setChainIndex] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);
  const iframeKeyRef = useRef(0);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // TV / Series state
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // DLNA state
  const [showDlnaPanel, setShowDlnaPanel] = useState(false);
  const [dlnaDevices, setDlnaDevices] = useState<DlnaDevice[]>([]);
  const [dlnaScanning, setDlnaScanning] = useState(false);
  const [selectedDlnaDevice, setSelectedDlnaDevice] = useState<DlnaDevice | null>(null);
  const [dlnaCasting, setDlnaCasting] = useState(false);

  // Determine content type
  const effectiveContentType = incomingContentType || (movieId?.startsWith("live-") ? "live" : "movie");
  const isLive = effectiveContentType === "live" || effectiveContentType === "sports";
  const isTv = effectiveContentType === "series" || effectiveContentType === "anime";

  const scrollY = useMotionValue(0);
  const imgY = useTransform(scrollY, [0, 300], [0, 300]);
  const imgOpacity = useTransform(scrollY, [0, 300], [0.75, 0.2]);
  const imgScale = useTransform(scrollY, [0, 300], [1, 1.15]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollY.set(e.currentTarget.scrollTop);
  };

  // ─── Fetch movie/tv details ─────────────────────────────────
  const { data: movie, isLoading } = useQuery({
    queryKey: QUERY_KEYS.movie(movieId, sessionCode, true),
    queryFn: async () => {
      if (!movieId || isLive) return null;
      const codeParam = sessionCode === null ? "" : (sessionCode ?? "");
      const res = await apiClient.get<MediaItem>(
        `/api/media/item/${movieId}?sessionCode=${codeParam}&includeUserState=1`
      );
      return res.data;
    },
    enabled: !!movieId && !isLive,
  });

  // ─── Fetch TV show details (seasons/episodes) ────────────────
  const { data: tvDetails } = useQuery({
    queryKey: ["tv-details", movieId],
    queryFn: async () => {
      if (!movieId || !isTv) return null;
      const res = await apiClient.get<any>(`/api/media/tv-details?id=${movieId}`);
      return res.data;
    },
    enabled: !!movieId && isTv,
  });

  // Load episodes when season changes
  useEffect(() => {
    if (!movieId || !isTv || !selectedSeason) return;
    setLoadingEpisodes(true);
    apiClient
      .get(`/api/media/tv-details?id=${movieId}&season=${selectedSeason}`)
      .then((res) => {
        setEpisodes(res.data.episodes || []);
        setSelectedEpisode(1);
      })
      .catch(() => setEpisodes([]))
      .finally(() => setLoadingEpisodes(false));
  }, [movieId, isTv, selectedSeason]);

  const {
    isInList, isLikedByMe, isTogglingWatchlist, isUnliking,
    handleToggleWatchlist, handleUnlike, useWatchlist, isGuest,
  } = useMovieActions(movie || null, {
    onUnlikeSuccess: onClose, sessionCode, includeUserState: true,
  });

  const { serverPublicUrl: runtimeServerUrl, capabilities: runtimeCapabilities, provider: runtimeProvider } = useRuntimeConfig();
  const { data: sessionStatus } = useSession({ enabled: !!movieId });
  const capabilities = sessionStatus?.capabilities || runtimeCapabilities;
  const activeProvider = sessionStatus?.provider || runtimeProvider;
  const serverPublicUrl = runtimeServerUrl;
  const detailsUrl = getProviderDetailsUrl({
    provider: activeProvider, serverPublicUrl,
    machineId: sessionStatus?.machineId, itemId: movie?.Id || "",
  });
  const languageLabel = getLanguageLabel(movie?.Language);

  const ratingSource = movie?.CommunityRatingSource?.toLowerCase();
  const isRottenTomatoes = ratingSource?.includes("rottentomatoes") || ratingSource?.includes("tomato");
  const ratingDisplay = typeof movie?.CommunityRating === "number"
    ? (isRottenTomatoes ? Math.round(movie.CommunityRating * 10) : movie.CommunityRating.toFixed(1))
    : null;

  // ─── Build embed chain based on content type ────────────────
  const embedChain = useMemo(() => {
    if (!movieId) return [];
    if (isLive && liveChannel) {
      return getLiveEmbedChain(liveChannel.id);
    }
    if (isTv) {
      return getTvEmbedChain(movieId, selectedSeason, selectedEpisode, selectedLang);
    }
    return getMovieEmbedChain(movieId, selectedLang);
  }, [movieId, isLive, isTv, liveChannel, selectedSeason, selectedEpisode, selectedLang]);

  const currentEmbed = embedChain[chainIndex] || null;
  const hasNextProvider = chainIndex < embedChain.length - 1;

  // ─── Fullscreen / landscape ──────────────────────────────────
  const enterFullscreenLandscape = useCallback(() => {
    const el = playerContainerRef.current;
    if (!el) return;
    try {
      el.requestFullscreen().then(() => {
        try { (screen.orientation as any).lock?.("landscape"); } catch {}
      }).catch(() => {});
    } catch {}
  }, []);

  const exitFullscreenLandscape = useCallback(() => {
    try { (screen.orientation as any).unlock?.(); } catch {}
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
  }, []);

  useEffect(() => {
    if (isPlaying) {
      const timer = setTimeout(enterFullscreenLandscape, 300);
      return () => clearTimeout(timer);
    } else {
      exitFullscreenLandscape();
    }
  }, [isPlaying, enterFullscreenLandscape, exitFullscreenLandscape]);

  useEffect(() => {
    const h = () => { if (!document.fullscreenElement && isPlaying) {} };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, [isPlaying]);

  // ─── Play / Stop / Language / Source switching ───────────────
  const handlePlay = useCallback((lang?: LanguageMode, season?: number, episode?: number) => {
    if (embedChain.length === 0) return;
    if (lang && lang !== selectedLang) setSelectedLang(lang);
    if (season !== undefined) setSelectedSeason(season);
    if (episode !== undefined) setSelectedEpisode(episode);
    setChainIndex(0);
    setPlayerError(null);
    setIsPlaying(true);
    iframeKeyRef.current++;
  }, [embedChain.length, selectedLang]);

  const handleLanguageChange = useCallback((lang: LanguageMode) => {
    if (lang === selectedLang && isPlaying) return;
    setSelectedLang(lang);
    setChainIndex(0);
    setPlayerError(null);
    setIsSwitchingSource(true);
    iframeKeyRef.current++;
  }, [selectedLang, isPlaying]);

  const handleSourceError = useCallback(() => {
    if (chainIndex < embedChain.length - 1) {
      setChainIndex((p) => p + 1);
      setPlayerError(null);
      setIsSwitchingSource(true);
      iframeKeyRef.current++;
    } else {
      setPlayerError("Nenhum servidor disponível. Tente outro idioma ou servidor.");
      setIsSwitchingSource(false);
    }
  }, [chainIndex, embedChain.length]);

  const handleNextServer = useCallback(() => {
    if (chainIndex < embedChain.length - 1) {
      setChainIndex((p) => p + 1);
      setPlayerError(null);
      setIsSwitchingSource(true);
      iframeKeyRef.current++;
    }
  }, [chainIndex, embedChain.length]);

  const handleStopPlaying = useCallback(() => {
    exitFullscreenLandscape();
    setIsPlaying(false);
    setPlayerError(null);
    setChainIndex(0);
    setIsSwitchingSource(false);
  }, [exitFullscreenLandscape]);

  // Reset on embed chain change
  useEffect(() => {
    setChainIndex(0);
    iframeKeyRef.current++;
  }, [embedChain]);

  // ─── DLNA ────────────────────────────────────────────────────
  const discoverDlnaDevices = useCallback(async () => {
    setDlnaScanning(true);
    try {
      const res = await fetch("/?XTransformPort=3005/discover", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setDlnaDevices(data.devices || []);
      }
    } catch {
      setDlnaDevices([]);
    } finally {
      setDlnaScanning(false);
    }
  }, []);

  const castToDlna = useCallback(async (device: DlnaDevice) => {
    if (!currentEmbed) return;
    setDlnaCasting(true);
    setSelectedDlnaDevice(device);
    try {
      await fetch("/?XTransformPort=3005/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceUrl: device.location,
          mediaUrl: currentEmbed.url,
          title: movie?.Name || liveChannel?.name || "Jane's Streaming",
        }),
      });
    } catch {}
    finally {
      setDlnaCasting(false);
    }
  }, [currentEmbed, movie, liveChannel]);

  const dlnaPause = useCallback(async () => {
    if (!selectedDlnaDevice) return;
    try {
      await fetch("/?XTransformPort=3005/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceUrl: selectedDlnaDevice.location }),
      });
    } catch {}
  }, [selectedDlnaDevice]);

  const dlnaStop = useCallback(async () => {
    if (!selectedDlnaDevice) return;
    try {
      await fetch("/?XTransformPort=3005/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceUrl: selectedDlnaDevice.location }),
      });
    } catch {}
  }, [selectedDlnaDevice]);

  // Display info for live channels
  const displayItem = isLive && liveChannel
    ? {
        Name: liveChannel.name,
        Overview: liveChannel.description,
        Genres: [liveChannel.category],
        ImageTags: { Primary: liveChannel.logo, Backdrop: null },
        ProductionYear: undefined,
        CommunityRating: undefined,
        OfficialRating: undefined,
        RunTimeTicks: undefined,
        People: [],
        Studios: [],
        WatchProviders: [],
        likedBy: [],
        Taglines: [],
        OriginalTitle: undefined,
      }
    : movie;

  return (
    <Drawer open={!!movieId} onOpenChange={(open: boolean) => !open && onClose()}>
      <DrawerContent>
        <DrawerTitle className="sr-only">Detalhes</DrawerTitle>
        <div
          onScroll={handleScroll}
          className={cn(
            "p-0 overflow-y-auto h-[90vh] sm:max-w-full outline-none mt-1 no-scrollbar relative",
            "mask-[linear-gradient(to_bottom,transparent_0%,black_30px,black_calc(100%-80px),transparent_100%)]"
          )}
        >
          {isLoading ? (
            <div className="h-64 w-full relative">
              <div className="absolute -bottom-12 left-4 flex items-end gap-3">
                <Skeleton className="w-28 h-40 rounded-lg shadow-2xl shadow-background border border-foreground/10 z-10 shrink-0" />
              </div>
              <Skeleton className="h-full w-full relative mask-[linear-gradient(to_bottom,black_60%,transparent_100%)]" />
              <div className="space-y-4 px-6 mt-20">
                <Skeleton className="h-11 w-3/4" />
                <div className="flex flex-row w-2/3 gap-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
            </div>
          ) : displayItem ? (
            <div className="relative">
              {/* PARALLAX BACKGROUND */}
              {!isLive && displayItem.ImageTags?.Backdrop && (
                <div className="relative w-full h-80 overflow-hidden bg-background">
                  <motion.div style={{ y: imgY, opacity: imgOpacity, scale: imgScale }} className="absolute inset-x-0 w-full h-full">
                    <OptimizedImage
                      src={displayItem.ImageTags.Backdrop
                        ? `/api/media/image/${movieId}?imageType=Backdrop&tag=${displayItem.ImageTags.Backdrop}`
                        : `/api/media/image/${movieId}?imageType=Backdrop`}
                      externalId={movieId!} imageType="Backdrop" alt="Backdrop"
                      width={400} height={225}
                      className="w-full h-full object-cover mask-[linear-gradient(to_bottom,transparent,black_12%,black_50%,transparent)] mask-no-repeat"
                    />
                  </motion.div>
                </div>
              )}

              {/* Live channel header */}
              {isLive && (
                <div className="w-full h-48 bg-gradient-to-br from-red-900/40 via-background to-background flex items-center justify-center">
                  <Radio className="size-16 text-red-500/30" />
                </div>
              )}

              {/* Header Content */}
              <div className={cn("flex items-end gap-3", isLive ? "px-6 -mt-20 relative z-10" : "absolute bottom-4 left-4 right-4 z-10")}>
                {isLive ? (
                  <img
                    src={liveChannel?.logo}
                    alt={displayItem.Name}
                    className="w-24 h-24 rounded-xl shadow-2xl bg-white p-2 object-contain z-10 shrink-0"
                  />
                ) : (
                  <OptimizedImage
                    src={displayItem.ImageTags?.Primary
                      ? `/api/media/image/${movieId}?tag=${displayItem.ImageTags.Primary}`
                      : `/api/media/image/${movieId}?imageType=Primary`}
                    externalId={movieId!} imageType="Primary"
                    width={75} height={125}
                    className="w-28 h-40 rounded-lg shadow-2xl shadow-background border border-foreground/10 object-cover z-10 shrink-0"
                    alt="Poster"
                  />
                )}
                <div className="flex-1 mb-1 z-10 overflow-hidden">
                  {displayItem.Genres && displayItem.Genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {displayItem.Genres.slice(0, 3).map((genre: string) => (
                        <span key={genre} className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/20 backdrop-blur-md">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="text-3xl font-bold leading-tight drop-shadow-lg text-foreground mb-1 line-clamp-2">
                    {displayItem.Name}
                  </h2>
                  {!!displayItem.ProductionYear && (
                    <div className="flex flex-wrap gap-3 text-xs items-center">
                      <span className="font-semibold text-foreground/90 text-xs/0">{displayItem.ProductionYear}</span>
                      {!!displayItem.OfficialRating && (
                        <Badge variant="outline" className="text-[10px]/0 py-0 h-4 border-foreground/30 text-foreground/80">
                          <ShieldCheck className="w-3 h-3" /> {displayItem.OfficialRating}
                        </Badge>
                      )}
                      {!!displayItem.CommunityRating && ratingDisplay !== null && (
                        <span className="flex items-center gap-1 font-bold text-xs/0">
                          {isRottenTomatoes ? <span className="text-yellow-400">%</span> : <Star className="w-3 h-3 fill-current" />}
                          {ratingDisplay}{isRottenTomatoes ? "%" : ""}
                        </span>
                      )}
                      {displayItem.RunTimeTicks && (
                        <span className="flex items-center gap-1 text-foreground/70 text-xs/0">
                          <Clock className="w-3 h-3" /> {ticksToTime(displayItem.RunTimeTicks)}
                        </span>
                      )}
                      {isTv && (tvDetails?.NumberOfSeasons || (displayItem as any)?.NumberOfSeasons) && (
                        <Badge variant="secondary" className="text-[10px] py-0 h-4">
                          <Tv className="w-3 h-3 mr-1" />
                          {tvDetails?.NumberOfSeasons || (displayItem as any)?.NumberOfSeasons} Temporadas
                        </Badge>
                      )}
                      {isLive && (
                        <Badge className="text-[10px] py-0 h-4 bg-red-600 hover:bg-red-700 text-white">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1" />
                          AO VIVO
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* MAIN CONTENT */}
              <div className="relative z-20 p-6 bg-background">
                {/* EMBED PLAYER */}
                {isPlaying && currentEmbed && (
                  <div className="mb-6 -mx-6 -mt-6 relative bg-black">
                    {/* Player top bar */}
                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-2 py-1.5 bg-gradient-to-b from-black/80 to-transparent">
                      <div className="flex gap-1">
                        {!isLive && LANGUAGE_OPTIONS.map((lang) => (
                          <Button
                            key={lang.id}
                            size="sm"
                            variant={selectedLang === lang.id ? "default" : "ghost"}
                            className={cn(
                              "h-7 px-2.5 text-[11px] rounded-full gap-1 border-0 transition-all",
                              selectedLang === lang.id
                                ? "bg-primary text-primary-foreground shadow-lg"
                                : "bg-black/50 text-white/80 hover:bg-black/70 hover:text-white"
                            )}
                            onClick={() => handleLanguageChange(lang.id)}
                          >
                            <span>{lang.flag}</span>
                            <span className="hidden sm:inline">{lang.label}</span>
                          </Button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        {isSwitchingSource && <Loader2 className="size-3.5 text-white/60 animate-spin mr-1" />}
                        <span className="text-[10px] text-white/50 hidden sm:block">{currentEmbed.provider.label}</span>
                        {hasNextProvider && !isSwitchingSource && (
                          <Button variant="secondary" size="sm" className="h-7 px-2 text-[10px] rounded-full bg-black/50 hover:bg-black/80 text-white/70 hover:text-white border-0 gap-1" onClick={handleNextServer}>
                            Próximo servidor
                          </Button>
                        )}
                        {/* DLNA Cast button */}
                        <Button
                          variant="secondary" size="icon" className="size-7 rounded-full bg-black/50 hover:bg-black/80 text-white border-0"
                          onClick={() => { setShowDlnaPanel(true); discoverDlnaDevices(); }}
                          title="Conectar na TV (DLNA)"
                        >
                          <Cast className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="secondary" size="icon" className="size-7 rounded-full bg-black/50 hover:bg-black/80 text-white border-0" onClick={enterFullscreenLandscape} title="Tela cheia">
                          <Maximize className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="secondary" size="icon" className="size-7 rounded-full bg-black/50 hover:bg-black/80 text-white border-0" onClick={handleStopPlaying}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* iframe */}
                    <div ref={playerContainerRef} className="relative w-full" style={{ aspectRatio: "16/9" }}>
                      <iframe
                        key={iframeKeyRef.current}
                        src={currentEmbed.url}
                        className="w-full h-full border-0"
                        allowFullScreen
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        referrerPolicy="no-referrer"
                        onError={handleSourceError}
                        onLoad={() => setIsSwitchingSource(false)}
                        title={`Player - ${displayItem.Name}`}
                      />
                      <button onClick={enterFullscreenLandscape} className="absolute bottom-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors opacity-0 hover:opacity-100 focus:opacity-100" title="Tela cheia">
                        <MonitorSmartphone className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Error overlay */}
                    {playerError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-3 p-4">
                        <AlertCircle className="w-10 h-10 text-destructive" />
                        <p className="text-sm text-center font-medium">{playerError}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handleStopPlaying} className="text-white border-white/30">Fechar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DLNA TV Panel (overlay) */}
                {showDlnaPanel && (
                  <div className="mb-6 -mx-6 bg-background border-t border-border/50 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Tv2 className="size-5 text-primary" />
                        <h3 className="font-bold text-sm">Conectar na TV</h3>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={discoverDlnaDevices} disabled={dlnaScanning}>
                          {dlnaScanning ? <Loader2 className="size-3 animate-spin mr-1" /> : <RefreshCw className="size-3 mr-1" />}
                          Escanear
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => setShowDlnaPanel(false)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {dlnaScanning && (
                      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                        <Loader2 className="size-6 animate-spin" />
                        <p className="text-xs">Procurando TVs na rede...</p>
                      </div>
                    )}

                    {!dlnaScanning && dlnaDevices.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                        <Tv className="size-8 opacity-30" />
                        <p className="text-xs text-center">Nenhuma TV encontrada na rede.<br />Certifique-se de que a TV está ligada e conectada na mesma rede Wi-Fi.</p>
                      </div>
                    )}

                    {dlnaDevices.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {dlnaDevices.map((device, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                              selectedDlnaDevice?.location === device.location
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30 hover:bg-muted/30"
                            )}
                            onClick={() => {
                              setSelectedDlnaDevice(device);
                              if (currentEmbed) castToDlna(device);
                            }}
                          >
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Tv className="size-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{device.friendlyName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{device.manufacturer} · {device.modelName}</p>
                            </div>
                            {selectedDlnaDevice?.location === device.location && (
                              <Badge className="bg-green-600 text-white text-[10px] shrink-0">Conectado</Badge>
                            )}
                            {!isPlaying && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">Toque para reproduzir</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* DLNA Controls */}
                    {selectedDlnaDevice && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={dlnaPause}>
                          <Pause className="size-3" /> Pausar
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={dlnaStop}>
                          <Square className="size-3" /> Parar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mb-6 flex-wrap">
                  <Button className="w-32" size="lg" onClick={() => handlePlay()}>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    {isLive ? "Assistir AO VIVO" : isTv ? "Assistir S1E1" : "Assistir"}
                  </Button>

                  {/* TV Cast button (always visible) */}
                  <Button
                    size="lg" variant="outline"
                    className="gap-2"
                    onClick={() => { setShowDlnaPanel(true); discoverDlnaDevices(); }}
                  >
                    <Tv2 className="w-4 h-4" />
                    <span className="hidden sm:inline">TV</span>
                  </Button>

                  {!isGuest && !isLive && capabilities.hasAuth && capabilities.hasWatchlist && (
                    <Button
                      className="w-32" size="lg"
                      variant={isInList ? "outline" : "secondary"}
                      onClick={() => handleToggleWatchlist()}
                      disabled={isTogglingWatchlist}
                    >
                      {useWatchlist
                        ? <Bookmark className={cn("w-4 h-4 mr-2", isInList && "fill-foreground")} />
                        : <Star className={cn("w-4 h-4 mr-2", isInList && "fill-foreground")} />}
                      {useWatchlist ? "Watchlist" : "Favorite"}
                    </Button>
                  )}
                  {isLikedByMe && !isLive && (
                    <Button variant="outline" size="lg" className="shrink-0 aspect-square p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleUnlike(); }} disabled={isUnliking}>
                      <HeartOff className="w-5 h-5" />
                    </Button>
                  )}
                </div>

                {/* SEASON / EPISODE PICKER (TV / Anime) */}
                {isTv && tvDetails?.Seasons && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Tv className="size-3.5" /> Temporadas
                    </h3>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                      {tvDetails.Seasons.filter((s: any) => s.season_number > 0).map((season: any) => (
                        <Button
                          key={season.season_number}
                          variant={selectedSeason === season.season_number ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-8 px-3 rounded-full text-xs font-medium shrink-0",
                            selectedSeason === season.season_number && "shadow-lg"
                          )}
                          onClick={() => setSelectedSeason(season.season_number)}
                        >
                          T{season.season_number}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Episode List */}
                {isTv && episodes.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                      Episódios — Temporada {selectedSeason}
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {episodes.map((ep: any) => (
                        <div
                          key={ep.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                            selectedEpisode === ep.episode_number
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30 hover:bg-muted/30"
                          )}
                          onClick={() => {
                            setSelectedEpisode(ep.episode_number);
                            handlePlay(selectedLang, selectedSeason, ep.episode_number);
                          }}
                        >
                          <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-mono font-bold text-muted-foreground">
                            {ep.episode_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ep.name}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{ep.overview}</p>
                          </div>
                          {ep.runtime && (
                            <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                              <Clock className="size-3" /> {ep.runtime}m
                            </span>
                          )}
                          <Play className="size-4 text-muted-foreground shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading episodes */}
                {isTv && loadingEpisodes && (
                  <div className="mb-6 py-8 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-xs">Carregando episódios...</span>
                  </div>
                )}

                {/* LIKED BY */}
                {showLikedBy && (movie as any)?.likedBy?.length > 0 && (movie as any).sessionCode && (
                  <div className="mb-6 bg-muted/20 p-4 rounded-xl border border-border/50">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Liked By</h3>
                    <UserAvatarList users={(movie as any).likedBy} size="lg" />
                  </div>
                )}

                {/* WATCH PROVIDERS */}
                {movie?.WatchProviders && movie.WatchProviders.length > 0 && (
                  <div className="mb-6 bg-muted/20 p-4 rounded-xl border border-border/50">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">Available On</h3>
                    <div className="flex flex-wrap gap-2">
                      {movie.WatchProviders.map((provider: WatchProvider) => (
                        <div key={provider.Id} className="flex items-center gap-2 bg-background/50 border rounded-lg px-2.5 py-1.5 shadow-sm">
                          <div className="relative size-5 overflow-hidden rounded">
                            <OptimizedImage src={`https://image.tmdb.org/t/p/w92${provider.LogoPath}`} alt={provider.Name} className="object-cover" unoptimized width={20} height={20} />
                          </div>
                          <span className="text-[11px] font-medium leading-none">{provider.Name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DETAILS ROW */}
                {!isLive && movie && (
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Director</h3>
                      <div className="text-foreground font-medium">
                        {movie.People?.find((p: any) => p.Type === "Director")?.Name || "Unknown"}
                      </div>
                    </div>
                    {!!languageLabel && (
                      <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Language</h3>
                        <div className="text-foreground font-medium truncate">{languageLabel}</div>
                      </div>
                    )}
                    {movie.Studios && (movie.Studios as any).length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Studio</h3>
                        <div className="text-foreground font-medium truncate">{(movie.Studios as any)[0].Name}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* SYNOPSIS */}
                {displayItem.Overview && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Synopsis</h3>
                    <p className="text-foreground/90 text-base leading-relaxed">{displayItem.Overview}</p>
                  </div>
                )}

                {/* CAST */}
                {movie?.People && movie.People.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">Cast</h3>
                    <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar -mx-6 px-6">
                      {movie.People.filter((p: any) => p.Type === "Actor").slice(0, 12).map((person: any) => (
                        <div key={person.Id} className="flex flex-col items-center gap-2 min-w-20 text-center">
                          <Avatar className="w-16 h-16 border border-border shadow-sm">
                            <AvatarImage src={person.PrimaryImageTag ? `/api/media/image/${person.Id}?tag=${person.PrimaryImageTag}` : undefined} className="object-cover" />
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                              {person.Name.split(" ").map((n: string) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col gap-0.5">
                            <div className="text-sm font-bold text-foreground leading-tight line-clamp-2 w-20">{person.Name}</div>
                            <div className="text-xs text-muted-foreground leading-tight line-clamp-2 w-20">{person.Role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
