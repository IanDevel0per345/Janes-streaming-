"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovieDetail } from "../movie/MovieDetailProvider";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { apiClient } from "@/lib/api-client";
import { MediaItem } from "@/types";
import { Search, X, Star, Clock, Film, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ticksToTime } from "@/lib/utils";

const MOVIES_PER_SESSION = 20;

interface CatalogResponse {
  items: MediaItem[];
  totalPages: number;
  currentPage: number;
  totalResults: number;
}

export function CatalogList() {
  const { openMovie } = useMovieDetail();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1500);
  const [totalResults, setTotalResults] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (page: number, term?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ session: page.toString() });
      if (term) params.set("searchTerm", term);
      const res = await apiClient.get<CatalogResponse>(`/api/media/catalog?${params}`);
      setItems(res.data.items || []);
      setTotalPages(res.data.totalPages || 1500);
      setTotalResults(res.data.totalResults || 0);
      setCurrentPage(res.data.currentPage || page);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load first page on mount
  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

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

  const goToSession = (page: number) => {
    setCurrentPage(page);
    fetchPage(page, debouncedTerm || undefined);
    // Scroll to top of the grid
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  // Generate visible page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const total = Math.min(totalPages, 1500);

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(total - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  };

  return (
    <div className="relative w-full h-full flex flex-col px-4 md:px-6 lg:px-8">
      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-3 mt-3 shrink-0">
        <div className="relative w-full max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar filmes..."
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

      {/* Section Title */}
      {!hasSearched && (
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <Film className="size-4 text-muted-foreground" />
            <h2 className="text-sm text-muted-foreground font-medium">
              Catálogo
              {totalResults > 0 && (
                <span className="font-mono ml-1">({totalResults.toLocaleString()} filmes)</span>
              )}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Sessão {currentPage}/{Math.min(totalPages, 1500)}
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
            <p className="text-sm">Nenhum filme disponível</p>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 pb-2">
          {items.map((movie) => (
            <CatalogCard
              key={`${movie.Id}-${currentPage}`}
              movie={movie}
              onClick={() => openMovie(movie.Id)}
            />
          ))}
        </div>
      </div>

      {/* Session Navigation */}
      {totalPages > 1 && !isLoading && items.length > 0 && (
        <div className="shrink-0 border-t border-border/50 pt-3 pb-2 mt-2">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={currentPage <= 1}
              onClick={() => goToSession(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`dot-${i}`} className="text-xs text-muted-foreground px-1">...</span>
              ) : (
                <Button
                  key={p}
                  variant={currentPage === p ? "default" : "ghost"}
                  size="sm"
                  className="size-8 text-xs font-mono px-0"
                  onClick={() => goToSession(p as number)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={currentPage >= Math.min(totalPages, 1500)}
              onClick={() => goToSession(currentPage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {hasSearched && totalPages > 1 && (
            <p className="text-center text-[10px] text-muted-foreground mt-1.5 font-mono">
              Página {currentPage} de {Math.min(totalPages, 1500)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CatalogCard({ movie, onClick }: { movie: MediaItem; onClick: () => void }) {
  const ratingSource = movie.CommunityRatingSource?.toLowerCase();
  const isRottenTomatoes = ratingSource?.includes("rottentomatoes") || ratingSource?.includes("tomato");
  const ratingDisplay = typeof movie.CommunityRating === "number"
    ? (isRottenTomatoes ? Math.round(movie.CommunityRating * 10) : movie.CommunityRating.toFixed(1))
    : null;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer flex flex-col gap-1.5"
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border border-border/50 transition-all group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5">
        <OptimizedImage
          src={movie.ImageTags?.Primary
            ? `/api/media/image/${movie.Id}?tag=${movie.ImageTags.Primary}`
            : `/api/media/image/${movie.Id}`
          }
          alt={movie.Name}
          externalId={movie.Id}
          height={300}
          width={200}
          blurDataURL={movie.BlurDataURL}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
        />
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
        {movie.ProductionYear && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <span className="text-[10px] font-medium text-white/80">{movie.ProductionYear}</span>
          </div>
        )}
      </div>
      <div className="px-0.5">
        <h3 className="text-xs font-semibold leading-tight line-clamp-2 text-foreground">
          {movie.Name}
        </h3>
        {movie.Genres && movie.Genres.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
            {movie.Genres.slice(0, 2).join(" · ")}
          </p>
        )}
        {movie.RunTimeTicks && (
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 mt-0.5">
            <Clock className="size-2.5" /> {ticksToTime(movie.RunTimeTicks)}
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
