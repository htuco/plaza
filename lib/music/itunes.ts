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

type ItunesResultEntry = {
  wrapperType?: string;
  artistId?: number;
  artistName?: string;
  trackId?: number;
  trackName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
};

type ItunesResponse = {
  results?: ItunesResultEntry[];
};

// iTunes responses are cacheable; avoid hammering the API for repeated setups.
async function fetchItunes(url: string): Promise<ItunesResultEntry[]> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as ItunesResponse;
  return data.results ?? [];
}

function toTrack(entry: ItunesResultEntry): ItunesTrack | null {
  if (
    typeof entry.trackId !== "number" ||
    typeof entry.trackName !== "string" ||
    typeof entry.artistName !== "string" ||
    typeof entry.previewUrl !== "string" ||
    entry.previewUrl.length === 0
  ) {
    return null;
  }
  return {
    trackId: String(entry.trackId),
    title: entry.trackName,
    artist: entry.artistName,
    previewUrl: entry.previewUrl,
    artworkUrl:
      typeof entry.artworkUrl100 === "string"
        ? entry.artworkUrl100.replace("100x100", "300x300")
        : null,
  };
}

// Resolve a search term to a single artist. `attribute=artistTerm` is ignored by
// the search endpoint (it still matches song titles), so the only reliable way
// to scope a source to one performer is to resolve the artist id first.
async function resolveArtistId(term: string): Promise<number | null> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=musicArtist&limit=1`;
  const [artist] = await fetchItunes(url);
  return typeof artist?.artistId === "number" ? artist.artistId : null;
}

// Every source term is an artist name, so search by artist and take that
// artist's catalogue. A plain `term=` search would also return songs whose
// *title* matched the term (searching "Magazin" returned "White Denim — Magazin").
export async function searchItunesTracks(term: string, limit = 25): Promise<ItunesTrack[]> {
  const artistId = await resolveArtistId(term);
  if (artistId === null) return [];

  const url = `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=${limit}`;
  const tracks: ItunesTrack[] = [];
  for (const entry of await fetchItunes(url)) {
    // The lookup response leads with the artist record itself; keep only tracks.
    if (entry.wrapperType !== "track") continue;
    const track = toTrack(entry);
    if (track) tracks.push(track);
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
