import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/auth/authorization.js';
import { calendarPreferencesSchema } from '$lib/validation/schemas.js';
import { parseBody } from '$lib/server/api/validate.js';
import {
	getCalendarPreferences,
	setCalendarPreferences,
	invalidateCalendarPreferencesCache
} from '$lib/server/settings/calendar-preferences.js';

export const GET: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;

	const data = await getCalendarPreferences();
	return json({ success: true, ...data });
};

export const PUT: RequestHandler = async (event) => {
	const authError = requireAdmin(event);
	if (authError) return authError;

	const result = await parseBody(event.request, calendarPreferencesSchema);

	await setCalendarPreferences(result);

	invalidateCalendarPreferencesCache();

	return json({ success: true, ...result });
};
