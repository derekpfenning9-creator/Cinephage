import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createChildLogger } from '$lib/logging';
import { calendarPreferencesSchema, type CalendarPreferences } from '$lib/validation/schemas.js';

const logger = createChildLogger({ module: 'CalendarPreferences' });
const SETTINGS_KEY = 'calendar_preferences';

let cached: CalendarPreferences | null = null;

export async function getCalendarPreferences(): Promise<CalendarPreferences> {
	if (cached) return cached;

	const row = await db.query.settings.findFirst({ where: eq(settings.key, SETTINGS_KEY) });

	if (row?.value) {
		try {
			const parsed = calendarPreferencesSchema.parse(JSON.parse(row.value));
			cached = parsed;
			return parsed;
		} catch {
			logger.warn('Failed to parse calendar preferences, using defaults');
		}
	}

	const defaults = calendarPreferencesSchema.parse({});
	cached = defaults;
	return defaults;
}

export async function setCalendarPreferences(
	data: CalendarPreferences
): Promise<CalendarPreferences> {
	await db
		.insert(settings)
		.values({ key: SETTINGS_KEY, value: JSON.stringify(data) })
		.onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(data) } });

	cached = data;
	return data;
}

export function invalidateCalendarPreferencesCache(): void {
	cached = null;
}
