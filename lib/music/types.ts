// Provider-agnostic music interface. Game module never sees HTTP details.
export interface TrackRound {
  trackId: string;
  title: string;
  artist: string;
  previewUrl: string; // 30s clip (iTunes); guaranteed non-null when returned
  coverArtUrl: string | null;
}

export interface MusicProvider {
  // Build a round list from a Spotify playlist; filters tracks without an iTunes preview.
  getRoundsFromPlaylist(playlistId: string, accessToken: string): Promise<TrackRound[]>;
  // Fuzzy-match a player's guess against accepted titles/artists.
  checkGuess(guess: string, round: TrackRound): { matchedTitle: boolean; matchedArtist: boolean };
}
