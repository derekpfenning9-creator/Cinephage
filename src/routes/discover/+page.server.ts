import { tmdb } from '$lib/server/tmdb';
import { getDiscoverResults } from '$lib/server/discover';
import {
	enrichWithLibraryStatus,
	filterInLibrary,
	filterBlockedMedia
} from '$lib/server/library/status';
import { keywordBlocklistService } from '$lib/server/settings/KeywordBlocklistService.js';
import type { WatchProvider } from '$lib/types/tmdb';
import type { TmdbCertificationsResponse } from '$lib/server/tmdb';
import { logger } from '$lib/logging';
import {
	parseDiscoverParams,
	isDefaultView as checkDefaultView,
	hasActiveDiscoverFilters
} from '$lib/utils/discoverParams';
import { TMDB } from '$lib/config/constants.js';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const params = parseDiscoverParams(url.searchParams);
	const {
		type,
		page,
		sortBy,
		trending,
		topRated,
		withWatchProviders,
		watchRegion,
		withGenres,
		withOriginalLanguage: urlOriginalLanguage,
		minDate,
		maxDate,
		minRating,
		certification,
		excludeInLibrary
	} = params;

	// Resolve effective original language — URL param takes precedence,
	// falling back to the user's global TMDB language filter.
	let withOriginalLanguage = urlOriginalLanguage;
	if (!withOriginalLanguage) {
		const filtersRow = await db.query.settings.findFirst({
			where: eq(settings.key, 'global_filters')
		});
		if (filtersRow?.value) {
			const globalFilters = JSON.parse(filtersRow.value);
			if (globalFilters?.language && typeof globalFilters.language === 'string') {
				withOriginalLanguage = globalFilters.language.toLowerCase().split('-')[0] || null;
			}
		}
	}

	// Merge globally blocked keywords into the without_keywords parameter
	const blockedKeywordIds = await keywordBlocklistService.getBlockedKeywordIds();
	const { withKeywords } = params;
	let { withoutKeywords } = params;
	if (blockedKeywordIds.length > 0) {
		const existingWithout = withoutKeywords ? withoutKeywords.split(',').filter(Boolean) : [];
		const merged = [...new Set([...existingWithout, ...blockedKeywordIds.map(String)])];
		withoutKeywords = merged.join(',');
	}

	const isDefaultViewCheck = checkDefaultView(url.searchParams, params);

	// Check if TMDB is configured before making any API calls
	const tmdbConfigured = await tmdb.isConfigured();
	if (!tmdbConfigured) {
		return {
			viewType: 'not_configured' as const,
			tmdbConfigured: false,
			providers: [],
			genres: [],
			certifications: [],
			languages: [],
			filters: {
				type,
				sort_by: sortBy,
				trending,
				top_rated: topRated,
				with_watch_providers: withWatchProviders,
				with_genres: withGenres,
				with_keywords: withKeywords,
				without_keywords: withoutKeywords,
				with_original_language: withOriginalLanguage,
				certification,
				exclude_in_library: excludeInLibrary
			}
		};
	}

	try {
		const systemRegion = await tmdb.getRegion();
		const [providersData, movieGenresData, tvGenresData, movieCertifications, languagesData] =
			await Promise.all([
				tmdb.getWatchProviders('movie', watchRegion || systemRegion) as Promise<{
					results: WatchProvider[];
				} | null>,
				tmdb.fetch('/genre/movie/list') as Promise<{
					genres: { id: number; name: string }[];
				} | null>,
				tmdb.fetch('/genre/tv/list') as Promise<{ genres: { id: number; name: string }[] } | null>,
				tmdb.getCertifications('movie') as Promise<TmdbCertificationsResponse>,
				tmdb.getLanguages().catch(() => [] as { iso_639_1: string; english_name: string }[])
			]);

		const languages = languagesData
			? languagesData
					.map((l) => ({
						code: l.iso_639_1,
						name: l.english_name
					}))
					.filter((l) => l.code)
					.sort((a, b) => a.name.localeCompare(b.name))
			: [];

		// Handle null responses (shouldn't happen since we checked tmdbConfigured, but be safe)
		if (!providersData || !movieGenresData || !tvGenresData) {
			return {
				viewType: 'not_configured' as const,
				tmdbConfigured: false,
				providers: [],
				genres: [],
				certifications: [],
				languages: [],
				filters: {
					type,
					sort_by: sortBy,
					trending,
					top_rated: topRated,
					with_watch_providers: withWatchProviders,
					with_genres: withGenres,
					with_original_language: withOriginalLanguage,
					certification,
					exclude_in_library: excludeInLibrary
				}
			};
		}

		const providers = providersData.results.sort((a, b) => a.display_priority - b.display_priority);

		// Combine genres, deduplicate by ID
		const allGenres = new Map<number, { id: number; name: string }>();
		movieGenresData.genres.forEach((g) => allGenres.set(g.id, g));
		tvGenresData.genres.forEach((g) => allGenres.set(g.id, g));
		const genres = Array.from(allGenres.values()).sort((a, b) => a.name.localeCompare(b.name));

		const usCertifications = (
			movieCertifications.certifications[watchRegion || systemRegion] ??
			movieCertifications.certifications[TMDB.DEFAULT_REGION] ??
			[]
		).map((c) => ({
			certification: c.certification,
			meaning: c.meaning,
			order: c.order
		}));

		// Type for paginated TMDB results
		interface TmdbPaginatedResult {
			results: Array<{ id: number } & Record<string, unknown>>;
			page: number;
			total_pages: number;
			total_results: number;
		}

		const trendingHasActiveFilters = hasActiveDiscoverFilters({
			type,
			sortBy,
			withWatchProviders,
			withGenres,
			withKeywords,
			withoutKeywords,
			withOriginalLanguage: urlOriginalLanguage,
			minDate,
			maxDate,
			minRating,
			certification
		});

		if ((trending === 'day' || trending === 'week') && !trendingHasActiveFilters) {
			const trendingResults = (await tmdb.fetch(
				`/trending/all/${trending}?page=${page}`
			)) as TmdbPaginatedResult;

			const enrichedResults = await enrichWithLibraryStatus(trendingResults.results);
			const blockedFilteredResults = await filterBlockedMedia(enrichedResults);
			const filteredResults = filterInLibrary(blockedFilteredResults, excludeInLibrary);

			return {
				viewType: 'grid',
				tmdbConfigured: true,
				results: filteredResults,
				pagination: {
					page: trendingResults.page,
					total_pages: trendingResults.total_pages,
					total_results: trendingResults.total_results
				},
				providers,
				genres,
				certifications: usCertifications,
				languages,
				filters: {
					type,
					sort_by: sortBy,
					trending,
					with_watch_providers: withWatchProviders,
					with_genres: withGenres,
					with_original_language: withOriginalLanguage,
					certification,
					exclude_in_library: excludeInLibrary
				}
			};
		}

		if (topRated === 'true' && !certification) {
			let endpoint: string;
			if (type === 'movie') {
				endpoint = `/movie/top_rated?page=${page}`;
			} else if (type === 'tv') {
				endpoint = `/tv/top_rated?page=${page}`;
			} else {
				// For 'all', fetch both and combine
				const [moviesData, tvData] = (await Promise.all([
					tmdb.fetch(`/movie/top_rated?page=${page}`),
					tmdb.fetch(`/tv/top_rated?page=${page}`)
				])) as TmdbPaginatedResult[];

				interface VoteRatedItem {
					id: number;
					vote_average?: number;
					media_type?: string;
				}
				const movieResults = moviesData.results.map(
					(m) => ({ ...m, media_type: 'movie' }) as VoteRatedItem
				);
				const tvResults = tvData.results.map((t) => ({ ...t, media_type: 'tv' }) as VoteRatedItem);
				const combinedResults = [...movieResults, ...tvResults].sort(
					(a, b) => (b.vote_average || 0) - (a.vote_average || 0)
				);

				const enrichedResults = await enrichWithLibraryStatus(combinedResults, 'all');
				const blockedFilteredResults = await filterBlockedMedia(enrichedResults, 'all');
				const filteredResults = filterInLibrary(blockedFilteredResults, excludeInLibrary);

				return {
					viewType: 'grid',
					tmdbConfigured: true,
					results: filteredResults,
					pagination: {
						page: 1,
						total_pages: Math.max(moviesData.total_pages, tvData.total_pages),
						total_results: moviesData.total_results + tvData.total_results
					},
					providers,
					genres,
					certifications: usCertifications,
					languages,
					filters: {
						type,
						sort_by: sortBy,
						trending,
						with_watch_providers: withWatchProviders,
						with_genres: withGenres,
						with_original_language: withOriginalLanguage,
						certification,
						exclude_in_library: excludeInLibrary
					}
				};
			}

			const topRatedResults = (await tmdb.fetch(endpoint)) as TmdbPaginatedResult;
			const mediaTypeFilter = type === 'movie' ? 'movie' : 'tv';
			const enrichedResults = await enrichWithLibraryStatus(
				topRatedResults.results,
				mediaTypeFilter
			);
			const blockedFilteredResults = await filterBlockedMedia(enrichedResults, mediaTypeFilter);
			const filteredResults = filterInLibrary(blockedFilteredResults, excludeInLibrary);

			return {
				viewType: 'grid',
				tmdbConfigured: true,
				results: filteredResults,
				pagination: {
					page: topRatedResults.page,
					total_pages: topRatedResults.total_pages,
					total_results: topRatedResults.total_results
				},
				providers,
				genres,
				certifications: usCertifications,
				languages,
				filters: {
					type,
					sort_by: sortBy,
					trending,
					with_watch_providers: withWatchProviders,
					with_genres: withGenres,
					with_original_language: withOriginalLanguage,
					certification,
					exclude_in_library: excludeInLibrary
				}
			};
		}

		if (isDefaultViewCheck && page === '1') {
			// Fetch sections for the dashboard-style view
			const [trendingWeek, popularMovies, popularTV, topRatedMovies, topRatedTV] =
				(await Promise.all([
					tmdb.fetch('/trending/all/week'),
					tmdb.fetch('/movie/popular'),
					tmdb.fetch('/tv/popular'),
					tmdb.fetch('/movie/top_rated'),
					tmdb.fetch('/tv/top_rated')
				])) as TmdbPaginatedResult[];

			// Enrich all sections with library status
			const [
				enrichedTrendingWeek,
				enrichedPopularMovies,
				enrichedPopularTV,
				enrichedTopRatedMovies,
				enrichedTopRatedTV
			] = await Promise.all([
				enrichWithLibraryStatus(trendingWeek.results),
				enrichWithLibraryStatus(popularMovies.results, 'movie'),
				enrichWithLibraryStatus(popularTV.results, 'tv'),
				enrichWithLibraryStatus(topRatedMovies.results, 'movie'),
				enrichWithLibraryStatus(topRatedTV.results, 'tv')
			]);

			const [
				blockedFilteredTrendingWeek,
				blockedFilteredPopularMovies,
				blockedFilteredPopularTV,
				blockedFilteredTopRatedMovies,
				blockedFilteredTopRatedTV
			] = await Promise.all([
				filterBlockedMedia(enrichedTrendingWeek),
				filterBlockedMedia(enrichedPopularMovies, 'movie'),
				filterBlockedMedia(enrichedPopularTV, 'tv'),
				filterBlockedMedia(enrichedTopRatedMovies, 'movie'),
				filterBlockedMedia(enrichedTopRatedTV, 'tv')
			]);

			return {
				viewType: 'dashboard',
				tmdbConfigured: true,
				sections: {
					trendingWeek: filterInLibrary(blockedFilteredTrendingWeek, excludeInLibrary),
					popularMovies: filterInLibrary(blockedFilteredPopularMovies, excludeInLibrary),
					popularTV: filterInLibrary(blockedFilteredPopularTV, excludeInLibrary),
					topRatedMovies: filterInLibrary(blockedFilteredTopRatedMovies, excludeInLibrary),
					topRatedTV: filterInLibrary(blockedFilteredTopRatedTV, excludeInLibrary)
				},
				providers,
				genres,
				certifications: usCertifications,
				languages,
				filters: {
					type,
					sort_by: sortBy,
					trending,
					with_watch_providers: withWatchProviders,
					with_genres: withGenres,
					with_original_language: withOriginalLanguage,
					certification,
					exclude_in_library: excludeInLibrary
				}
			};
		} else {
			// Use shared logic
			const { results, pagination } = await getDiscoverResults({
				type,
				page,
				sortBy,
				trending,
				withWatchProviders,
				watchRegion,
				withGenres,
				withKeywords,
				withoutKeywords,
				withOriginalLanguage,
				minDate,
				maxDate,
				minRating,
				certification
			});

			// Enrich results with library status
			const mediaTypeFilter = type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : 'all';
			const enrichedResults = await enrichWithLibraryStatus(results, mediaTypeFilter);
			const blockedFilteredResults = await filterBlockedMedia(enrichedResults, mediaTypeFilter);
			const filteredResults = filterInLibrary(blockedFilteredResults, excludeInLibrary);

			return {
				viewType: 'grid',
				tmdbConfigured: true,
				results: filteredResults,
				pagination,
				providers,
				genres,
				certifications: usCertifications,
				languages,
				filters: {
					type,
					sort_by: sortBy,
					trending,
					with_watch_providers: withWatchProviders,
					with_genres: withGenres,
					with_original_language: withOriginalLanguage,
					certification,
					exclude_in_library: excludeInLibrary
				}
			};
		}
	} catch (e) {
		logger.error({ err: e, ...{ type, sortBy } }, 'Discover load error');
		return {
			viewType: 'error',
			tmdbConfigured: true,
			error: 'Failed to load content',
			providers: [],
			genres: [],
			certifications: [],
			languages: [],
			filters: {
				type,
				sort_by: sortBy,
				trending,
				top_rated: topRated,
				with_watch_providers: withWatchProviders,
				with_genres: withGenres,
				with_keywords: withKeywords,
				without_keywords: withoutKeywords,
				with_original_language: withOriginalLanguage,
				certification,
				exclude_in_library: excludeInLibrary
			}
		};
	}
};
