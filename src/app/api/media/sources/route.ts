import { NextRequest, NextResponse } from "next/server";
import { MovieSourceService } from "@/lib/services/movie-source-service";
import { logger } from "@/lib/logger";

/**
 * Embed URL generators — deterministic, no API calls needed.
 * When the DB has no sources for a movie, we generate embed URLs
 * on-the-fly from the TMDB ID so the app always has playback options.
 */
const EMBED_GENERATORS = [
  { name: "vidsrc-me", title: "VidSrc.me", buildUrl: (id: string) => `https://vidsrc.me/embed/tmdb/${id}` },
  { name: "vidsrc-cc", title: "VidSrc.cc", buildUrl: (id: string) => `https://vidsrc.cc/v2/embed/movie/${id}` },
  { name: "vidlink", title: "VidLink", buildUrl: (id: string) => `https://vidlink.pro/movie/tmdb/${id}` },
  { name: "2embed", title: "2Embed", buildUrl: (id: string) => `https://www.2embed.cc/embed/tmdb/${id}` },
  { name: "multiembed", title: "MultiEmbed", buildUrl: (id: string) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1` },
];

/** Generate embed sources on-the-fly for a movie ID */
function generateEmbedSources(movieId: string) {
  return EMBED_GENERATORS.map((gen, idx) => ({
    id: -(idx + 1), // Negative IDs indicate generated (not from DB)
    movieId,
    url: gen.buildUrl(movieId),
    type: "embed",
    quality: null,
    language: "en",
    title: gen.title,
    provider: gen.name,
    status: "active",
  }));
}

/**
 * GET /api/media/sources?movieId=xxx
 * Get all active playback sources for a movie.
 * Falls back to generated embed URLs if DB has no sources.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const movieId = searchParams.get("movieId");

    if (!movieId) {
      return NextResponse.json(
        { error: "movieId query parameter is required" },
        { status: 400 }
      );
    }

    const includeAll = searchParams.get("all") === "true";
    
    let sources: Array<{ id: number; movieId: string; url: string; type: string; quality: string | null; language: string | null; title: string | null; provider: string; status: string; addedAt: string; lastCheckedAt: string | null }> = [];
    try {
      sources = includeAll
        ? await MovieSourceService.getAllSourcesForMovie(movieId)
        : await MovieSourceService.getSourcesForMovie(movieId);
    } catch (dbError) {
      // DB might not be available (e.g., Vercel serverless without persistent storage)
      logger.debug(`DB sources fetch failed, using generated embed URLs: ${dbError}`);
      sources = [];
    }

    // If no DB sources, generate embed URLs on-the-fly
    const activeSources = sources.filter(s => s.status === "active");
    if (activeSources.length === 0) {
      const generated = generateEmbedSources(movieId);
      logger.debug(`No DB sources for movie ${movieId}, generated ${generated.length} embed URLs`);
      return NextResponse.json({ sources: generated });
    }

    return NextResponse.json({ sources: activeSources });
  } catch (error) {
    logger.error(`Sources API GET error: ${error}`);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/media/sources
 * Add a new playback source for a movie
 * Body: { movieId, url, type, quality?, language?, title?, provider }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { movieId, url, type, quality, language, title, provider } = body;

    if (!movieId || !url || !provider) {
      return NextResponse.json(
        { error: "movieId, url, and provider are required" },
        { status: 400 }
      );
    }

    if (!MovieSourceService.isValidUrl(url)) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const source = await MovieSourceService.addSource({
      movieId,
      url,
      type: type || "embed",
      quality: quality || null,
      language: language || null,
      title: title || null,
      provider,
      status: "active",
      lastCheckedAt: null,
    });

    if (!source) {
      return NextResponse.json(
        { error: "Failed to add source (duplicate or invalid)" },
        { status: 409 }
      );
    }

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    logger.error(`Sources API POST error: ${error}`);
    return NextResponse.json(
      { error: "Failed to add source" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/media/sources?id=xxx
 * Delete a source by ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const movieId = searchParams.get("movieId");

    if (movieId) {
      await MovieSourceService.deleteSourcesForMovie(movieId);
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json(
        { error: "id or movieId query parameter is required" },
        { status: 400 }
      );
    }

    const success = await MovieSourceService.deleteSource(parseInt(id, 10));
    return NextResponse.json({ success });
  } catch (error) {
    logger.error(`Sources API DELETE error: ${error}`);
    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/media/sources
 * Update a source's status
 * Body: { id, status }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!["active", "inactive", "broken"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'active', 'inactive', or 'broken'" },
        { status: 400 }
      );
    }

    const success = await MovieSourceService.updateSourceStatus(id, status);
    return NextResponse.json({ success });
  } catch (error) {
    logger.error(`Sources API PATCH error: ${error}`);
    return NextResponse.json(
      { error: "Failed to update source" },
      { status: 500 }
    );
  }
}
