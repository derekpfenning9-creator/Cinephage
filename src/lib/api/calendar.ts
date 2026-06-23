import { apiGet, apiPut } from './client.js';
import type { CalendarPreferences } from '$lib/validation/schemas.js';

export async function getCalendar(
	month?: string,
	type?: 'all' | 'movies' | 'episodes',
	libraryOnly?: boolean,
	minRating?: number,
	genreIds?: number[],
	excludeAdult?: boolean,
	certifications?: string[]
) {
	const params: Record<string, string> = {};
	if (month) params.month = month;
	if (type && type !== 'all') params.type = type;
	if (libraryOnly) params.libraryOnly = 'true';
	if (minRating && minRating > 0) params.minRating = String(minRating);
	if (genreIds && genreIds.length > 0) params.genreIds = genreIds.join(',');
	if (excludeAdult) params.excludeAdult = 'true';
	if (certifications && certifications.length > 0) params.certifications = certifications.join(',');
	return apiGet('/api/calendar', params);
}

export async function getUpcoming() {
	return apiGet('/api/calendar/upcoming');
}

export async function getCalendarPreferences() {
	return apiGet('/api/settings/calendar-preferences');
}

export async function updateCalendarPreferences(prefs: CalendarPreferences) {
	return apiPut('/api/settings/calendar-preferences', prefs);
}
