import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const year = searchParams.get('year');

    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    try {
        const query = encodeURIComponent(title);
        const yearParam = year ? `&primary_release_year=${year}` : '';
        const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${query}${yearParam}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
            const movie = data.results[0];

            // Fetch extra details like runtime/genres
            const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${apiKey}`);
            const detailData = await detailRes.json();

            return NextResponse.json({
                tmdbId: movie.id,
                overview: movie.overview,
                posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                backdropPath: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
                voteAverage: movie.vote_average,
                genres: detailData.genres?.map((g: any) => g.name) || [],
                runtime: detailData.runtime || 0,
            });
        }

        return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch from TMDB' }, { status: 500 });
    }
}