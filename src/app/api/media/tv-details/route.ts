import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { handleApiError } from '@/lib/api-utils';
import axios from 'axios';

interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  overview: string;
  poster_path: string | null;
  episodes?: TmdbEpisode[];
}

interface TmdbEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
  vote_average: number;
}

interface TmdbTvDetails {
  id: number;
  name: string;
 original_name: string;
  overview: string;
  first_air_date: string;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  vote_average: number;
  vote_count: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ id: number; name: string }>;
  created_by: Array<{ id: number; name: string; profile_path: string | null }>;
  seasons: TmdbSeason[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tvId = searchParams.get('id');
  const seasonNumber = searchParams.get('season');

  if (!tvId) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const apiKey = config.TMDB_API_KEY || config.TMDB_ACCESS_TOKEN;
  if (!apiKey) return NextResponse.json({ error: 'TMDB not configured' }, { status: 500 });

  const isV3 = apiKey.length === 32 && /^[a-f0-9]+$/i.test(apiKey);
  const headers: Record<string, string> | undefined = !isV3
    ? { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
    : undefined;
  const extraParams = isV3 ? { api_key: apiKey } : {};

  try {
    // If season is requested, fetch season details with episodes
    if (seasonNumber) {
      const res = await axios.get<TmdbSeason>(
        `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}`,
        { headers, params: extraParams, timeout: 10000 }
      );
      return NextResponse.json(res.data);
    }

    // Fetch full TV show details (includes seasons list)
    const res = await axios.get<TmdbTvDetails>(
      `https://api.themoviedb.org/3/tv/${tvId}`,
      {
        headers,
        params: { ...extraParams, append_to_response: 'credits' },
        timeout: 10000,
      }
    );

    const data = res.data;
    return NextResponse.json({
      Id: data.id.toString(),
      Name: data.name,
      OriginalTitle: data.original_name,
      Overview: data.overview,
      ProductionYear: data.first_air_date ? new Date(data.first_air_date).getFullYear() : undefined,
      CommunityRating: data.vote_average,
      ImageTags: {
        Primary: data.poster_path,
        Backdrop: data.backdrop_path,
      },
      Genres: data.genres?.map((g) => g.name) || [],
      NumberOfSeasons: data.number_of_seasons,
      NumberOfEpisodes: data.number_of_episodes,
      Status: data.status,
      Seasons: data.seasons?.map((s) => ({
        id: s.id,
        season_number: s.season_number,
        name: s.name,
        episode_count: s.episode_count,
        air_date: s.air_date,
        poster_path: s.poster_path,
      })),
      CreatedBy: data.created_by?.map((c) => ({
        id: c.id,
        name: c.name,
        profile_path: c.profile_path,
      })),
      ContentType: 'series',
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch TV details');
  }
}
