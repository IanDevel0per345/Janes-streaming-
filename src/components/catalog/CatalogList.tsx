"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovieDetail } from "../movie/MovieDetailProvider";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { apiClient } from "@/lib/api-client";
import { MediaItem } from "@/types";
import {
  Search, X, Star, Clock, Film, Tv, Sparkles, Radio, Trophy,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LIVE_CATEGORIES, LiveCategory } from "@/lib/live-channels";
import { ContentType } from "@/lib/embed-providers";

const ITEMS_PER_PAGE = 20;

interface CatalogResponse {
  items: MediaItem[];
  totalPages: number;
  currentPage: number;
  totalResults: number;
  contentType?: string;
}

interface ContentTab {
  id: ContentType;
  label: string;
  icon: React.ReactNode;
  totalLabel: string;
}

const CONTENT_TABS: ContentTab[] = [
  { id: "movie", label: "Filmes", icon: <Film className="size-4" />, totalLabel: "filmes" },
  { id: "series", label: "Séries", icon: <Tv className="size-4" />, totalLabel: "séries" },
  { id: "anime", label: "Animes", icon: <Sparkles className="size-4" />, totalLabel: "animes" },
  { id: "live", label: "TV ao Vivo", icon: <Radio className="size-4" />, totalLabel: "canais" },
  { id: "sports", label: "Esportes", icon: <Trophy className="size-4" />, totalLabel: "canais" },
];

export function CatalogList() {
  const { openMovie } = useMovieDetail();
  const [activeType, setActiveType] = useState<ContentType>("movie");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(50000);
  const [totalResults, setTotalResults] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [liveCategory, setLiveCategory] = useState<LiveCategory | null>(null);

  const fetchPage = useCallback(async (page: number, term?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        type: activeType,
        page: page.toString(),
      });
      if (term) params.set("searchTerm", term);
      if (liveCategory && (activeType === "live")) params.set("category", liveCategory);
      const res = await apiClient.get<CatalogResponse>(`/api/media/catalog?${params}`);
      setItems(res.data.items || []);
      setTotalPages(res.data.totalPages || 500);
      setTotalResults(res.data.totalResults || 0);
      setCurrentPage(res.data.currentPage || page);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeType, liveCategory]);

  // Reload when content type changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchTerm("");
    setDebouncedTerm("");
    setHasSearched(false);
    setLiveCategory(null);
    fetchPage(1);
  }, [activeType, fetchPage]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) {
      setDebouncedTerm("");
      setHasSearched(false);
      setCurrentPage(1);
      fetchPage(1);
      return;
    }
    timerRef.current = setTimeout(() => {
      setDebouncedTerm(value);
      setHasSearched(true);
      setCurrentPage(1);
      fetchPage(1, value);
    }, 500);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setDebouncedTerm("");
    setHasSearched(false);
    setCurrentPage(1);
    fetchPage(1);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    fetchPage(page, debouncedTerm || undefined);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const handleJumpToPage = () => {
    const p = parseInt(jumpValue);
    if (p >= 1 && p <= totalPages) {
      goToPage(p);
      setJumpDialogOpen(false);
      setJumpValue("");
    }
  };

  const handleItemClick = (item: MediaItem) => {
    if ((item as any).LiveChannel) {
      // Open live channel directly in player
      openMovie(item.Id, { contentType: "live", liveChannel: (item as any).LiveChannel });
    } else {
      openMovie(item.Id, { contentType: (item as any).ContentType || activeType });
    }
  };

  const getTabTotal = (type: ContentType): string => {
    if (type === "live" || type === "sports") {
      return "35+";
    }
    return ">1M";
  };

  return (
    <div className="relative w-full h-full flex flex-col px-4 md:px-6 lg:px-8">
      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-3 mt-3 shrink-0">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={`Buscar ${activeType === "movie" ? "filmes" : activeType === "series" ? "séries" : activeType === "anime" ? "animes" : "canais"}...`}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-9 h-10 bg-muted/40 border-border/50 rounded-full text-sm"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Type Tabs */}
      <div className="flex items-center gap-2 mb-3 shrink-0 overflow-x-auto no-scrollbar">
        {CONTENT_TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeType === tab.id ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-8 px-3 rounded-full gap-1.5 text-xs font-medium whitespace-nowrap transition-all shrink-0",
              activeType === tab.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
            onClick={() => setActiveType(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <Badge
              variant="secondary"
              className={cn(
                "h-4 px-1.5 text-[10px] font-mono rounded-full",
                activeType === tab.id
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {getTabTotal(tab.id)}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Live TV Category Filter */}
      {activeType === "live" && !hasSearched && (
        <div className="flex items-center gap-1.5 mb-3 shrink-0 overflow-x-auto no-scrollbar">
          <Button
            variant={!liveCategory ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 rounded-full text-[11px] shrink-0"
            onClick={() => setLiveCategory(null)}
          >
            Todos
          </Button>
          {LIVE_CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={liveCategory === cat.id ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 rounded-full text-[11px] shrink-0 gap-1"
              onClick={() => setLiveCategory(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Section Title */}
      {!hasSearched && (
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-2">
            {activeType === "movie" && <Film className="size-4 text-muted-foreground" />}
            {activeType === "series" && <Tv className="size-4 text-muted-foreground" />}
            {activeType === "anime" && <Sparkles className="size-4 text-muted-foreground" />}
            {activeType === "live" && <Radio className="size-4 text-muted-foreground" />}
            {activeType === "sports" && <Trophy className="size-4 text-muted-foreground" />}
            <h2 className="text-sm text-muted-foreground font-medium">
              {CONTENT_TABS.find(t => t.id === activeType)?.label}
              {totalResults > 0 && (
                <span className="font-mono ml-1">({totalResults.toLocaleString()} {CONTENT_TABS.find(t => t.id === activeType)?.totalLabel})</span>
              )}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Página {currentPage.toLocaleString()}/{totalPages.toLocaleString()}
          </span>
        </div>
      )}
      {hasSearched && debouncedTerm && !isLoading && (
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <Search className="size-4 text-muted-foreground" />
          <h2 className="text-sm text-muted-foreground font-medium">
            Resultados para &ldquo;{debouncedTerm}&rdquo;
            {totalResults > 0 && <span className="font-mono ml-1">({totalResults.toLocaleString()})</span>}
          </h2>
        </div>
      )}

      {/* Content Grid */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {isLoading && items.length === 0 && <CatalogSkeleton />}

        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Film className="size-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhum conteúdo disponível</p>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 pb-2">
          {items.map((item) => (
            <CatalogCard
              key={`${item.Id}-${currentPage}`}
              item={item}
              contentType={activeType}
              onClick={() => handleItemClick(item)}
            />
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && !isLoading && items.length > 0 && (
        <div className="shrink-0 border-t border-border/50 pt-3 pb-2 mt-2">
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <Button
              variant="ghost" size="icon" className="size-8"
              disabled={currentPage <= 1}
              onClick={() => goToPage(1)}
              title="Primeira página"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="ghost" size="icon" className="size-8"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>

            {/* Smart page numbers */}
            {getSmartPageNumbers(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`dot-${i}`} className="text-xs text-muted-foreground px-0.5">...</span>
              ) : (
                <Button
                  key={p}
                  variant={currentPage === p ? "default" : "ghost"}
                  size="sm"
                  className="size-8 text-xs font-mono px-0"
                  onClick={() => goToPage(p as number)}
                >
                  {formatPageNumber(p as number)}
                </Button>
              )
            )}

            <Button
              variant="ghost" size="icon" className="size-8"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost" size="icon" className="size-8"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(totalPages)}
              title="Última página"
            >
              <ChevronsRight className="size-4" />
            </Button>

            {/* Jump to page */}
            <Button
              variant="outline" size="sm"
              className="h-8 px-2 text-[10px] font-mono ml-2 rounded-full"
              onClick={() => setJumpDialogOpen(true)}
            >
              Ir para...
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5 font-mono">
            {currentPage.toLocaleString()} de {totalPages.toLocaleString()} páginas · {(currentPage * ITEMS_PER_PAGE).toLocaleString()} itens exibidos
          </p>
        </div>
      )}

      {/* Jump to Page Dialog */}
      <Dialog open={jumpDialogOpen} onOpenChange={setJumpDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ir para página</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            max={totalPages}
            placeholder={`1 — ${totalPages.toLocaleString()}`}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJumpToPage()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setJumpDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleJumpToPage} disabled={!jumpValue}>Ir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Smart pagination: shows 7 pages around current, with ellipsis */
function getSmartPageNumbers(current: number, total: number): (number | "...")[] {
  const pages: (number | "...")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  pages.push(1);
  if (current > 4) pages.push("...");

  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 3) pages.push("...");
  pages.push(total);
  return pages;
}

/** Shorten large page numbers: 15000 → 15K */
function formatPageNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toString();
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

interface CatalogCardProps {
  item: MediaItem;
  contentType: ContentType;
  onClick: () => void;
}

function CatalogCard({ item, contentType, onClick }: CatalogCardProps) {
  const isLive = (item as any).LiveChannel;
  const isSeries = contentType === "series" || contentType === "anime";
  const ratingSource = item.CommunityRatingSource?.toLowerCase();
  const isRottenTomatoes = ratingSource?.includes("rottentomatoes") || ratingSource?.includes("tomato");
  const ratingDisplay = typeof item.CommunityRating === "number"
    ? (isRottenTomatoes ? Math.round(item.CommunityRating * 10) : item.CommunityRating.toFixed(1))
    : null;

  // For live channels, use the logo directly
  const imageSrc = isLive
    ? (item as any).LiveChannel?.logo
    : item.ImageTags?.Primary
      ? `/api/media/image/${item.Id}?tag=${item.ImageTags.Primary}`
      : `/api/media/image/${item.Id}`;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer flex flex-col gap-1.5"
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 transition-all group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5">
        {isLive ? (
          <img
            src={imageSrc}
            alt={item.Name}
            className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <OptimizedImage
            src={imageSrc}
            alt={item.Name}
            externalId={item.Id}
            height={300}
            width={200}
            blurDataURL={item.BlurDataURL}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
          />
        )}

        {/* Rating badge */}
        {ratingDisplay !== null && (
          <div className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-0.5">
            {isRottenTomatoes ? (
              <span className="text-[10px] font-bold text-yellow-400">{ratingDisplay}%</span>
            ) : (
              <>
                <Star className="size-2.5 text-yellow-400 fill-yellow-400" />
                <span className="text-[10px] font-bold text-white">{ratingDisplay}</span>
              </>
            )}
          </div>
        )}

        {/* Year badge */}
        {item.ProductionYear && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <span className="text-[10px] font-medium text-white/80">{item.ProductionYear}</span>
          </div>
        )}

        {/* Live indicator */}
        {isLive && (
          <div className="absolute top-1.5 right-1.5 bg-red-600 rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[9px] font-bold text-white uppercase">AO VIVO</span>
          </div>
        )}

        {/* Series/Anime badge */}
        {isSeries && (item as any).NumberOfSeasons && (
          <div className="absolute top-1.5 right-1.5 bg-primary/80 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <span className="text-[9px] font-bold text-primary-foreground">
              {(item as any).NumberOfSeasons}T
            </span>
          </div>
        )}
      </div>
      <div className="px-0.5">
        <h3 className="text-xs font-semibold leading-tight line-clamp-2 text-foreground">
          {item.Name}
        </h3>
        {item.Genres && item.Genres.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
            {item.Genres.slice(0, 2).join(" · ")}
          </p>
        )}
        {item.RunTimeTicks && (
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 mt-0.5">
            <Clock className="size-2.5" /> {ticksToTime(item.RunTimeTicks)}
          </p>
        )}
      </div>
    </div>
  );
}

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="aspect-[2/3] rounded-lg" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ticksToTime(ticks: number): string {
  const totalMinutes = Math.floor(ticks / 600000000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
