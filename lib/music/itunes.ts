import "server-only";

// iTunes Search API — no key needed, previews are public 30s clips.
// Spotify's preview_url is deprecated/null for new apps, so previews come from here.

export interface ItunesTrack {
  trackId: string;
  title: string;
  artist: string;
  previewUrl: string;
  artworkUrl: string | null;
}

type ItunesSearchResult = {
  results?: Array<{
    trackId?: number;
    trackName?: string;
    artistName?: string;
    previewUrl?: string;
    artworkUrl100?: string;
  }>;
};

export async function searchItunesTracks(term: string, limit = 25): Promise<ItunesTrack[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    // iTunes responses are cacheable; avoid hammering the API for repeated setups.
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as ItunesSearchResult;
  const tracks: ItunesTrack[] = [];
  for (const result of data.results ?? []) {
    if (
      typeof result.trackId !== "number" ||
      typeof result.trackName !== "string" ||
      typeof result.artistName !== "string" ||
      typeof result.previewUrl !== "string" ||
      result.previewUrl.length === 0
    ) {
      continue;
    }
    tracks.push({
      trackId: String(result.trackId),
      title: result.trackName,
      artist: result.artistName,
      previewUrl: result.previewUrl,
      artworkUrl:
        typeof result.artworkUrl100 === "string"
          ? result.artworkUrl100.replace("100x100", "300x300")
          : null,
    });
  }
  return tracks;
}

// Fetch several search terms, dedupe by track and (artist,title), shuffle.
export async function collectTracksForTerms(terms: string[], perTerm = 25): Promise<ItunesTrack[]> {
  const settled = await Promise.allSettled(terms.map((term) => searchItunesTracks(term, perTerm)));
  const seenIds = new Set<string>();
  const seenSongs = new Set<string>();
  const tracks: ItunesTrack[] = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const track of result.value) {
      const songKey = `${track.artist.toLowerCase()}::${track.title.toLowerCase()}`;
      if (seenIds.has(track.trackId) || seenSongs.has(songKey)) continue;
      seenIds.add(track.trackId);
      seenSongs.add(songKey);
      tracks.push(track);
    }
  }
  // Fisher-Yates shuffle so rounds differ between sessions.
  for (let index = tracks.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [tracks[index], tracks[swapIndex]] = [tracks[swapIndex], tracks[index]];
  }
  return tracks;
}
