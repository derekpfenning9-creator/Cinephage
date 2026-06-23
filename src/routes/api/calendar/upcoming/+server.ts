import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { getUpcomingItems } from '$lib/server/calendar/queries.js';
import { getCalendarPreferences } from '$lib/server/settings/calendar-preferences.js';

const upcomingQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(20).default(7)
});

export const GET: RequestHandler = async ({ url }) => {
	const result = upcomingQuerySchema.safeParse(Object.fromEntries(url.searchParams));
	if (!result.success) {
		return json({ error: 'Invalid parameters' }, { status: 400 });
	}

	const prefs = await getCalendarPreferences();
	const items = await getUpcomingItems(result.data.limit, prefs.upcomingShowNonLibrary);
	return json(items);
};
