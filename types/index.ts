export interface LetterboxdRawItem {
    Title: string;
    Year: string;
    Date?: string;
    Rating?: string;
}

export interface MovieItem {
  id: string;
  title: string;
  year: number;
  letterboxdRating?: number;
  watchedDate?: string;
  listType: 'watched' | 'watchlist' | 'diary';
  tmdbId?: number;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  voteAverage?: number;
  genres?: string[];
  runtime?: number;
}
