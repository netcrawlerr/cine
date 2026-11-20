'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Search, Film, Star, Calendar, Bookmark, Loader2, Sparkles, UploadCloud, Database, X, Clock, Award, Globe, Film as FilmIcon } from 'lucide-react';
import { MovieItem } from '@/types';

const CACHE_KEY = 'cine_tmdb_cache_v2';

export default function CineDashboard() {
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [cacheCount, setCacheCount] = useState(0);

  // UI Controls & Filters
  const [activeTab, setActiveTab] = useState<'watched' | 'watchlist' | 'diary'>('watched');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortBy, setSortBy] = useState<'title' | 'year' | 'rating' | 'date'>('rating');
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);

  // Load cache stats on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCacheCount(Object.keys(parsed).length);
      }
    } catch (e) {
      console.error('Failed to read cache', e);
    }
  }, []);

  // Handle Bulk Upload of all CSVs at once with cache pre-hydration
  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setUploadStatus(`Parsing ${files.length} file(s)...`);

    let allWatched: any[] = [];
    let allWatchlist: any[] = [];
    let allDiary: any[] = [];
    let ratingsMap = new Map<string, number>();
    let filesProcessed = 0;

    Array.from(files).forEach((file) => {
      const fileName = file.name.toLowerCase();

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as any[];

          if (fileName.includes('ratings') || fileName.includes('diary')) {
            rows.forEach((row) => {
              const title = (row.Title || row.Name || row.film_title || '').trim();
              const year = row.Year || row.release_year || '';
              const rawRating = row.Rating || row.rating;
              if (title && rawRating) {
                const numericRating = parseFloat(rawRating);
                if (!isNaN(numericRating)) {
                  ratingsMap.set(`${title.toLowerCase()}-${year}`, numericRating);
                  ratingsMap.set(title.toLowerCase(), numericRating);
                }
              }
            });
          }

          if (fileName.includes('watchlist')) {
            allWatchlist.push(...rows);
          } else if (fileName.includes('diary')) {
            allDiary.push(...rows);
          } else {
            allWatched.push(...rows);
          }

          filesProcessed++;

          if (filesProcessed === files.length) {
            let tmdbCache: Record<string, any> = {};
            try {
              const cachedStr = localStorage.getItem(CACHE_KEY);
              if (cachedStr) tmdbCache = JSON.parse(cachedStr);
            } catch (err) {}

            const applyCache = (title: string, year: number) => {
              const key = `${title.toLowerCase()}-${year}`;
              return tmdbCache[key] || tmdbCache[title.toLowerCase()] || {};
            };

            const formattedWatched: MovieItem[] = allWatched
              .map((row, idx) => {
                const title = row.Title || row.Name || row.film_title;
                const year = parseInt(row.Year || row.release_year, 10) || 0;
                if (!title) return null;

                const cleanTitle = title.trim();
                const rating =
                  row.Rating ? parseFloat(row.Rating) :
                  ratingsMap.get(`${cleanTitle.toLowerCase()}-${year}`) ||
                  ratingsMap.get(cleanTitle.toLowerCase());

                const cachedData = applyCache(cleanTitle, year);

                return {
                  id: `watched-${idx}-${cleanTitle}-${year}`,
                  title: cleanTitle,
                  year: isNaN(year) ? 0 : year,
                  letterboxdRating: rating && !isNaN(rating) ? rating : undefined,
                  watchedDate: row.Date || row['Watched Date'] || row.watched_date,
                  listType: 'watched' as const,
                  ...cachedData,
                };
              })
              .filter(Boolean) as MovieItem[];

            const formattedWatchlist: MovieItem[] = allWatchlist
              .map((row, idx) => {
                const title = row.Title || row.Name || row.film_title;
                const year = parseInt(row.Year || row.release_year, 10) || 0;
                if (!title) return null;

                const cleanTitle = title.trim();
                const rating = ratingsMap.get(`${cleanTitle.toLowerCase()}-${year}`) || ratingsMap.get(cleanTitle.toLowerCase());
                const cachedData = applyCache(cleanTitle, year);

                return {
                  id: `watchlist-${idx}-${cleanTitle}-${year}`,
                  title: cleanTitle,
                  year: isNaN(year) ? 0 : year,
                  letterboxdRating: rating && !isNaN(rating) ? rating : undefined,
                  listType: 'watchlist' as const,
                  ...cachedData,
                };
              })
              .filter(Boolean) as MovieItem[];

            const formattedDiary: MovieItem[] = allDiary
              .map((row, idx) => {
                const title = row.Title || row.Name || row.film_title;
                const year = parseInt(row.Year || row.release_year, 10) || 0;
                if (!title) return null;

                const cleanTitle = title.trim();
                const rating =
                  row.Rating ? parseFloat(row.Rating) :
                  ratingsMap.get(`${cleanTitle.toLowerCase()}-${year}`) ||
                  ratingsMap.get(cleanTitle.toLowerCase());
                const cachedData = applyCache(cleanTitle, year);

                return {
                  id: `diary-${idx}-${cleanTitle}-${year}`,
                  title: cleanTitle,
                  year: isNaN(year) ? 0 : year,
                  letterboxdRating: rating && !isNaN(rating) ? rating : undefined,
                  watchedDate: row.Date || row['Watched Date'] || row.watched_date,
                  listType: 'diary' as const,
                  ...cachedData,
                };
              })
              .filter(Boolean) as MovieItem[];

            const combined = [...formattedWatched, ...formattedWatchlist, ...formattedDiary];
            const uniqueMovies = Array.from(
              new Map(combined.map((m) => [`${m.listType}-${m.title}-${m.year}`, m])).values()
            );

            setMovies(uniqueMovies);
            setLoading(false);
            setUploadStatus(`Successfully loaded ${uniqueMovies.length} movies with local cache applied!`);
            setTimeout(() => setUploadStatus(null), 5000);
          }
        },
        error: (err) => {
          console.error('Error parsing CSV:', err);
          filesProcessed++;
          if (filesProcessed === files.length) setLoading(false);
        },
      });
    });
  };

  // Enrich movies with TMDB metadata & LocalStorage Caching
  const enrichWithTMDB = async () => {
    if (movies.length === 0) return;
    setEnriching(true);
    setEnrichProgress({ current: 0, total: movies.length });

    let tmdbCache: Record<string, any> = {};
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) tmdbCache = JSON.parse(cachedStr);
    } catch (e) {}

    const updated = [...movies];
    for (let i = 0; i < updated.length; i++) {
      const movie = updated[i];
      const cacheKey = `${movie.title.toLowerCase()}-${movie.year}`;

      if (movie.tmdbId) {
        setEnrichProgress({ current: i + 1, total: movies.length });
        continue;
      }

      if (tmdbCache[cacheKey] || tmdbCache[movie.title.toLowerCase()]) {
        const cached = tmdbCache[cacheKey] || tmdbCache[movie.title.toLowerCase()];
        updated[i] = { ...movie, ...cached };
        setEnrichProgress({ current: i + 1, total: movies.length });
        continue;
      }

      try {
        const res = await fetch(`/api/tmdb?title=${encodeURIComponent(movie.title)}&year=${movie.year}`);
        if (res.ok) {
          const data = await res.json();
          updated[i] = { ...movie, ...data };

          tmdbCache[cacheKey] = data;
          tmdbCache[movie.title.toLowerCase()] = data;
          localStorage.setItem(CACHE_KEY, JSON.stringify(tmdbCache));
        }
      } catch (err) {
        console.error(`Failed TMDB for ${movie.title}`);
      }

      setEnrichProgress({ current: i + 1, total: movies.length });
      await new Promise((r) => setTimeout(r, 120));
      setMovies([...updated]);
    }

    try {
      setCacheCount(Object.keys(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')).length);
    } catch (e) {}

    setEnriching(false);
  };

  // Filter & Sort
  const filteredMovies = movies
    .filter((m) => {
      const matchesTab = m.listType === activeTab;
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = selectedGenre === 'All' || m.genres?.includes(selectedGenre);
      return matchesTab && matchesSearch && matchesGenre;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'year') return b.year - a.year;
      if (sortBy === 'rating') return (b.letterboxdRating || 0) - (a.letterboxdRating || 0);
      if (sortBy === 'date') return (b.watchedDate || '').localeCompare(a.watchedDate || '');
      return 0;
    });

  const allGenres = Array.from(new Set(movies.flatMap((m) => m.genres || [])));

  return (
    <main className="min-h-screen bg-[#0c1014] text-[#9ab] pb-24 font-sans selection:bg-[#00e054] selection:text-black">
      {/* Liquid Glass Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0c1014]/70 border-b border-white/10 px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <Film className="w-7 h-7 text-[#00e054] drop-shadow-[0_0_10px_rgba(0,224,84,0.4)]" />
          <h1 className="text-lg sm:text-xl font-black tracking-widest text-white">CINE</h1>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
          {cacheCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#89a] bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
              <Database className="w-3.5 h-3.5 text-[#00b0ff]" />
              <span>{cacheCount} cached</span>
            </div>
          )}

          <label className="cursor-pointer bg-white/[0.05] hover:bg-white/[0.08] text-white font-medium text-xs px-4 py-2.5 rounded-xl border border-white/10 backdrop-blur-xl shadow-lg transition flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#00b0ff]" />
            <span>Import CSVs</span>
            <input type="file" accept=".csv" multiple onChange={handleBulkUpload} className="hidden" />
          </label>

          {movies.length > 0 && (
            <button
              onClick={enrichWithTMDB}
              disabled={enriching}
              className="bg-[#00e054] hover:bg-[#00c046] text-[#0c1014] font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(0,224,84,0.25)]"
            >
              {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {enriching ? `Syncing (${enrichProgress.current}/${enrichProgress.total})` : 'Fetch Banners'}
            </button>
          )}
        </div>
      </header>

      {uploadStatus && (
        <div className="bg-white/[0.03] border-b border-white/10 backdrop-blur-md px-6 py-2.5 text-center text-xs font-medium text-[#00e054]">
          {uploadStatus}
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {movies.length === 0 ? (
          <div className="text-center py-32 border border-white/10 rounded-3xl bg-white/[0.01] backdrop-blur-xl shadow-2xl">
            <UploadCloud className="w-16 h-16 text-white/30 mx-auto mb-4 animate-pulse" />
            <h2 className="text-lg font-bold text-white mb-2">Import your Letterboxd library</h2>
            <p className="text-xs max-w-sm mx-auto mb-6 text-[#789] leading-relaxed">
              Upload your exported CSV files. Previously fetched TMDB posters and backdrops will load instantly from local browser cache.
            </p>
            {loading && <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#00e054]" />}
          </div>
        ) : (
          <>
            {/* Filter & Sorting Liquid Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-8 bg-white/[0.02] p-4 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 w-full lg:w-auto justify-center">
                {(['watched', 'watchlist', 'diary'] as const).map((tab) => {
                  const count = movies.filter((m) => m.listType === tab).length;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                        activeTab === tab ? 'bg-[#00e054] text-[#0c1014] shadow-lg font-bold' : 'text-[#89a] hover:text-white'
                      }`}
                    >
                      {tab} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#678]" />
                  <input
                    type="text"
                    placeholder="Search movies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-[#567] focus:outline-none focus:border-[#00e054] backdrop-blur-md"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00e054] backdrop-blur-md flex-1 sm:flex-none"
                  >
                    <option value="All">All Genres</option>
                    {allGenres.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00e054] backdrop-blur-md flex-1 sm:flex-none"
                  >
                    <option value="rating">Sort: Your Rating</option>
                    <option value="year">Sort: Release Year</option>
                    <option value="title">Sort: Title (A-Z)</option>
                    <option value="date">Sort: Watched Date</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Movie Grid: 4 Cards per Row */}
            {filteredMovies.length === 0 ? (
              <div className="text-center py-20 text-[#678] bg-white/[0.01] rounded-2xl border border-white/10 backdrop-blur-md">
                No movies found in <span className="text-white capitalize font-semibold">{activeTab}</span> matching your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredMovies.map((movie) => (
                  <div
                    key={movie.id}
                    onClick={() => setSelectedMovie(movie)}
                    className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-[#00e054]/50"
                  >
                    {/* Backdrop Banner */}
                    <div className="h-32 bg-black/50 relative overflow-hidden">
                      {movie.backdropPath ? (
                        <img
                          src={movie.backdropPath}
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-700 opacity-70 group-hover:opacity-90"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-white/30">No Banner</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#12161b] via-transparent to-transparent" />
                    </div>

                    <div className="p-4 flex gap-3 -mt-10 relative z-10">
                      {/* Poster */}
                      <div className="w-16 h-24 bg-[#1a222b] rounded-xl flex-shrink-0 shadow-2xl border border-white/10 overflow-hidden">
                        {movie.posterPath ? (
                          <img src={movie.posterPath} alt={movie.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-center p-1 text-white/30">Poster</div>
                        )}
                      </div>

                      <div className="flex-1 pt-1 overflow-hidden">
                        <h3 className="text-white font-bold text-xs truncate leading-snug">{movie.title}</h3>
                        <span className="text-[10px] text-white/40 font-mono">{movie.year || 'N/A'}</span>

                        {/* Your Rating */}
                        {movie.letterboxdRating !== undefined && !isNaN(movie.letterboxdRating) ? (
                          <div className="flex items-center gap-1 mt-1.5">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const isFilled = star <= movie.letterboxdRating!;
                                const isHalf = !isFilled && star - 0.5 <= movie.letterboxdRating!;
                                return (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${
                                      isFilled
                                        ? 'fill-[#00e054] text-[#00e054]'
                                        : isHalf
                                        ? 'fill-[#00e054]/50 text-[#00e054]'
                                        : 'text-white/10 fill-white/10'
                                    }`}
                                  />
                                );
                              })}
                            </div>
                            <span className="text-[10px] font-mono text-[#00e054] font-semibold">{movie.letterboxdRating}★</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-white/30 italic mt-1.5">Unrated</div>
                        )}
                      </div>
                    </div>

                    {/* Overview snippet */}
                    <div className="px-4 pb-4 flex-1 flex flex-col justify-between">
                      <p className="text-[11px] text-white/60 line-clamp-2 mb-3 leading-relaxed">
                        {movie.overview || 'Click to view details and TMDB metadata.'}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {movie.genres?.slice(0, 2).map((g) => (
                          <span key={g} className="text-[9px] bg-white/5 text-white/70 px-2 py-0.5 rounded-full border border-white/5">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Expanded Cinematic Movie Detail Modal */}
      {selectedMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-[#10141a] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]">

            {/* Cinematic Header Backdrop */}
            <div className="h-64 sm:h-80 relative overflow-hidden bg-black flex-shrink-0">
              {selectedMovie.backdropPath ? (
                <img src={selectedMovie.backdropPath} alt={selectedMovie.title} className="w-full h-full object-cover opacity-75 scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-white/30">No Banner Available</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#10141a] via-[#10141a]/60 to-transparent" />

              <button
                onClick={() => setSelectedMovie(null)}
                className="absolute top-5 right-5 bg-black/70 hover:bg-black text-white p-2.5 rounded-full border border-white/20 transition backdrop-blur-xl shadow-2xl z-20"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-6 left-6 sm:left-10 right-6 flex items-end justify-between z-10">
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#00e054] font-bold font-mono">Vault Entry</span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">{selectedMovie.title}</h2>
                </div>
              </div>
            </div>

            {/* Expanded Detailed Body */}
            <div className="p-6 sm:p-10 overflow-y-auto space-y-8">

              {/* Top Row: Poster & Core Metadata */}
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <div className="w-36 sm:w-48 h-52 sm:h-72 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20 flex-shrink-0 mx-auto sm:mx-0">
                  {selectedMovie.posterPath ? (
                    <img src={selectedMovie.posterPath} alt={selectedMovie.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/40">Poster</div>
                  )}
                </div>

                <div className="flex-1 space-y-4 w-full">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-mono text-white/70 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 font-bold">
                      📅 Released: {selectedMovie.year}
                    </span>
                    {selectedMovie.runtime && (
                      <span className="text-xs font-mono text-white/70 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#00b0ff]" /> {selectedMovie.runtime} mins
                      </span>
                    )}
                    <span className="text-xs font-mono text-white/70 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 uppercase">
                      Category: {selectedMovie.listType}
                    </span>
                  </div>

                  {/* Ratings breakdown box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
                      <span className="text-[10px] uppercase tracking-wider text-white/50 block font-mono">Your Personal Score</span>
                      {selectedMovie.letterboxdRating !== undefined && !isNaN(selectedMovie.letterboxdRating) ? (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex text-[#00e054]">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const isFilled = star <= selectedMovie.letterboxdRating!;
                              const isHalf = !isFilled && star - 0.5 <= selectedMovie.letterboxdRating!;
                              return (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    isFilled
                                      ? 'fill-[#00e054] text-[#00e054]'
                                      : isHalf
                                      ? 'fill-[#00e054]/50 text-[#00e054]'
                                      : 'text-white/10 fill-white/10'
                                  }`}
                                />
                              );
                            })}
                          </div>
                          <span className="text-sm font-mono text-[#00e054] font-bold">{selectedMovie.letterboxdRating} / 5.0</span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/40 italic mt-1 block">Not rated in your CSV logs</span>
                      )}
                    </div>

                    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
                      <span className="text-[10px] uppercase tracking-wider text-white/50 block font-mono">TMDB Public Rating</span>
                      <div className="flex items-center gap-2 mt-2">
                        <Award className="w-4 h-4 text-[#00b0ff]" />
                        <span className="text-sm font-mono text-white font-bold">{selectedMovie.voteAverage ? `${selectedMovie.voteAverage} / 10` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedMovie.genres?.map((g) => (
                      <span key={g} className="text-xs bg-white/5 text-white/90 px-3 py-1 rounded-xl border border-white/10 font-medium">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Synopsis Section */}
              <div className="space-y-3 bg-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 font-mono">Synopsis & Overview</h3>
                <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                  {selectedMovie.overview || 'No extended overview available for this title. Try fetching TMDB metadata from the main dashboard.'}
                </p>
              </div>

              {/* Activity Log Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                  <Calendar className="w-5 h-5 text-[#00e054]" />
                  <div>
                    <span className="text-[10px] text-white/40 block uppercase tracking-wider font-mono">Watched Date / Log</span>
                    <span className="text-xs text-white font-semibold">{selectedMovie.watchedDate || 'Logged in Watchlist / Unrecorded'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                  <Globe className="w-5 h-5 text-[#00b0ff]" />
                  <div>
                    <span className="text-[10px] text-white/40 block uppercase tracking-wider font-mono">TMDB Internal ID</span>
                    <span className="text-xs text-white font-mono">{selectedMovie.tmdbId ? `#${selectedMovie.tmdbId}` : 'Not synced yet'}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </main>
  );
}
