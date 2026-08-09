"use client";

import { useState, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useMovieDetail } from "../movie/MovieDetailProvider";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { apiClient } from "@/lib/api-client";
import { MediaItem } from "@/types";
import { Search, X, Star, Clock, Film } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ticksToTime } from "@/lib/utils";

export function CatalogList() {
  const { openMovie } = useMovieDetail();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load trending on mount
  const loadTrending = useCallback(async () => {
    if (trendingLoading || trending.length > 0) return;
    setTrendingLoading(true);
    try {
      const res = await apiClient.get<{ items: MediaItem[]; totalCount: number }>("/api/media/items?page=0&limit=20");
      setTrending(res.data.items || []);
    } catch {
      // ignore
    } finally {
      setTrendingLoading(false);
    }
  }, [trendingLoading, trending.length]);

  if (!hasSearched && trending.length === 0 && !trendingLoading) {
    loadTrending();
  }

  const search = useCallback(async (term: string, pageNum: number = 0) => {
    if (!term.trim()) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ items: MediaItem[]; totalCount: number }>(
        `/api/media/items?searchTerm=${encodeURIComponent(term)}&page=${pageNum}&limit=20`
      );
      const items = res.data.items || [];
      if (pageNum === 0) {
        setResults(items);
      } else {
        setResults(prev => [...prev, ...items]);
      }
      setHasMore(items.length >= 20);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) {
      setDebouncedTerm("");
      setHasSearched(false);
      setResults([]);
      setPage(0);
      setHasMore(true);
      return;
    }
    timerRef.current = setTimeout(() => {
      setDebouncedTerm(value);
      setHasSearched(true);
      setPage(0);
      setHasMore(true);
      search(value, 0);
    }, 500);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setDebouncedTerm("");
    setHasSearched(false);
    setResults([]);
    setPage(0);
    setHasMore(true);
  };

  const loadMore = () => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    search(debouncedTerm, nextPage);
  };

  const displayItems = hasSearched ? results : trending;

  return (
    <div className="relative w-full mx-auto h-[calc(100svh-115px)] flex flex-col">
      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar filmes..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9 h-10 bg-muted/40 border-border/50 rounded-full text-sm"
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
        <div className="flex items-center gap-2 mb-3">
          <Film className="size-4 text-muted-foreground" />
          <h2 className="text-sm text-muted-foreground font-medium">Em destaque</h2>
        </div>
      )}
      {hasSearched && debouncedTerm && !isLoading && (
        <div className="flex items-center gap-2 mb-3">
          <Search className="size-4 text-muted-foreground" />
          <h2 className="text-sm text-muted-foreground font-medium">
            Resultados para &ldquo;{debouncedTerm}&rdquo; <span className="font-mono">({displayItems.length})</span>
          </h2>
        </div>
      )}

      {/* Content Grid */}
      <ScrollArea className="flex-1 h-[calc(100svh-175px)] -mr-5 pr-5">
        {isLoading && page === 0 && <CatalogSkeleton />}
        {!hasSearched && trendingLoading && <CatalogSkeleton />}

        {!hasSearched && !trendingLoading && trending.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Film className="size-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhum filme disponível</p>
          </div>
        )}

        {hasSearched && !isLoading && displayItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="size-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum resultado encontrado</p>
            <p className="text-xs mt-1 opacity-60">Tente buscar por outro termo</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-14">
          {displayItems.map((movie) => (
            <CatalogCard
              key={movie.Id}
              movie={movie}
              onClick={() => openMovie(movie.Id)}
            />
          ))}
        </div>

        {/* Load More */}
        {hasSearched && hasMore && displayItems.length > 0 && (
          <div className="flex justify-center pb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isLoading}
              className="rounded-full text-xs"
            >
              {isLoading ? "Carregando..." : "Carregar mais"}
            </Button>
          </div>
        )}
      </ScrollArea>
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
          sizes="33vw"
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
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="aspect-[2/3] rounded-lg" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
