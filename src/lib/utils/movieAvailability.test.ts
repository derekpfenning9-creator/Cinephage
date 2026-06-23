import { describe, it, expect } from 'vitest';
import { getMovieAvailabilityLevel, isMovieAvailableForSearch } from './movieAvailability';

describe('getMovieAvailabilityLevel', () => {
	const now = new Date('2026-06-10T00:00:00.000Z');

	describe('with typed release_dates data', () => {
		it('returns released when past Digital date exists', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 4, release_date: '2026-05-19T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('released');
		});

		it('returns released when past Physical date exists', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 5, release_date: '2026-06-01T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('released');
		});

		it('returns released when past TV date exists', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 6, release_date: '2026-06-05T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('released');
		});

		it('returns inCinemas when only theatrical dates exist (status Released)', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-22',
					releaseDates: [
						{ type: 1, release_date: '2026-05-14T00:00:00.000Z' },
						{ type: 3, release_date: '2026-05-22T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('inCinemas');
		});

		it('returns inCinemas when Digital date is in the future', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-05-01',
					releaseDates: [
						{ type: 3, release_date: '2026-05-01T00:00:00.000Z' },
						{ type: 4, release_date: '2026-07-15T00:00:00.000Z' }
					]
				},
				now
			);
			expect(availability).toBe('inCinemas');
		});

		it('returns announced when theatrical date is in the future (status Released)', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Released',
					releaseDate: '2026-07-01',
					releaseDates: [{ type: 3, release_date: '2026-07-01T00:00:00.000Z' }]
				},
				now
			);
			expect(availability).toBe('announced');
		});

		it('returns announced when status is planned and no downloadable dates', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2027,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Planned',
					releaseDates: []
				},
				now
			);
			expect(availability).toBe('announced');
		});
	});

	describe('without release_dates data (backward compatibility)', () => {
		it('uses TMDB released status when available', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z',
					tmdbStatus: 'Released'
				},
				now
			);

			expect(availability).toBe('released');
		});

		it('uses TMDB pre-release statuses as announced', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z',
					tmdbStatus: 'In Production'
				},
				now
			);

			expect(availability).toBe('announced');
		});

		it('treats post production with a future theatrical date as announced', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Post Production',
					releaseDate: '2026-08-20'
				},
				now
			);

			expect(availability).toBe('announced');
		});

		it('treats post production with a past theatrical date as released', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-06-01T00:00:00.000Z',
					tmdbStatus: 'Post Production',
					releaseDate: '2026-05-01'
				},
				now
			);

			expect(availability).toBe('released');
		});

		it('uses release date when status is unknown', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z',
					releaseDate: '2026-01-27'
				},
				now
			);

			expect(availability).toBe('released');
		});

		it('falls back to legacy heuristics when TMDB metadata is missing', () => {
			const availability = getMovieAvailabilityLevel(
				{
					year: 2026,
					added: '2026-02-19T00:00:00.000Z'
				},
				now
			);

			expect(availability).toBe('inCinemas');
		});
	});
});

describe('isMovieAvailableForSearch', () => {
	const now = new Date('2026-06-10');

	it('announced: always available', () => {
		expect(
			isMovieAvailableForSearch(
				{ minimumAvailability: 'announced', releaseDate: '2027-01-01' },
				now
			)
		).toBe(true);
	});

	it('inCinemas: available when theatrical date is past', () => {
		expect(
			isMovieAvailableForSearch(
				{ minimumAvailability: 'inCinemas', releaseDate: '2026-05-01' },
				now
			)
		).toBe(true);
	});

	it('inCinemas: not available when theatrical date is future', () => {
		expect(
			isMovieAvailableForSearch(
				{ minimumAvailability: 'inCinemas', releaseDate: '2026-07-01' },
				now
			)
		).toBe(false);
	});

	it('inCinemas with delay: respects delay offset', () => {
		expect(
			isMovieAvailableForSearch(
				{ minimumAvailability: 'inCinemas', releaseDate: '2026-06-05', availabilityDelay: 7 },
				now
			)
		).toBe(false);
	});

	it('released: available when digital date is past', () => {
		expect(
			isMovieAvailableForSearch(
				{
					minimumAvailability: 'released',
					releaseDate: '2026-04-01',
					digitalReleaseDate: '2026-06-01'
				},
				now
			)
		).toBe(true);
	});

	it('released: not available when digital date is future', () => {
		expect(
			isMovieAvailableForSearch(
				{
					minimumAvailability: 'released',
					releaseDate: '2026-05-01',
					digitalReleaseDate: '2026-07-01'
				},
				now
			)
		).toBe(false);
	});

	it('released with delay: respects delay after digital date', () => {
		expect(
			isMovieAvailableForSearch(
				{
					minimumAvailability: 'released',
					releaseDate: '2026-04-01',
					digitalReleaseDate: '2026-06-05',
					availabilityDelay: 14
				},
				now
			)
		).toBe(false);
	});

	it('released: falls back to theatrical + 90 days when no digital/physical', () => {
		expect(
			isMovieAvailableForSearch({ minimumAvailability: 'released', releaseDate: '2026-03-01' }, now)
		).toBe(true);
	});

	it('released: theatrical + 90 days fallback not yet met', () => {
		expect(
			isMovieAvailableForSearch({ minimumAvailability: 'released', releaseDate: '2026-05-01' }, now)
		).toBe(false);
	});

	it('released: available when downloadReleaseDate (e.g. streaming) is past', () => {
		expect(
			isMovieAvailableForSearch(
				{
					minimumAvailability: 'released',
					releaseDate: '2026-05-01',
					downloadReleaseDate: '2026-06-01'
				},
				now
			)
		).toBe(true);
	});

	it('released: not available when only a future downloadReleaseDate exists', () => {
		expect(
			isMovieAvailableForSearch(
				{
					minimumAvailability: 'released',
					releaseDate: '2026-05-01',
					downloadReleaseDate: '2026-07-01'
				},
				now
			)
		).toBe(false);
	});

	it('released: no dates at all returns false', () => {
		expect(isMovieAvailableForSearch({ minimumAvailability: 'released' }, now)).toBe(false);
	});
});
