"use client";

import React, { createContext, useContext, useState } from "react";
import { MovieDetailView } from "./MovieDetailView";
import { ContentType } from "@/lib/embed-providers";
import { LiveChannel } from "@/lib/live-channels";

interface MovieDetailOptions {
  showLikedBy?: boolean;
  sessionCode?: string | null;
  contentType?: ContentType;
  liveChannel?: LiveChannel;
}

interface MovieDetailContextType {
  openMovie: (id: string, options?: MovieDetailOptions) => void;
  closeMovie: () => void;
}

const MovieDetailContext = createContext<MovieDetailContextType | undefined>(undefined);

export function MovieDetailProvider({ children }: { children: React.ReactNode }) {
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [options, setOptions] = useState<MovieDetailOptions | undefined>();

  const openMovie = (id: string, opts?: MovieDetailOptions) => {
    setSelectedMovieId(id);
    setOptions(opts);
  };
  const closeMovie = () => {
    setSelectedMovieId(null);
    setOptions(undefined);
  };

  return (
    <MovieDetailContext.Provider value={{ openMovie, closeMovie }}>
      {children}
      <MovieDetailView
        movieId={selectedMovieId}
        onClose={closeMovie}
        showLikedBy={options?.showLikedBy}
        sessionCode={options?.sessionCode}
        contentType={options?.contentType}
        liveChannel={options?.liveChannel}
      />
    </MovieDetailContext.Provider>
  );
}

export function useMovieDetail() {
  const context = useContext(MovieDetailContext);
  if (context === undefined) {
    throw new Error("useMovieDetail must be used within a MovieDetailProvider");
  }
  return context;
}