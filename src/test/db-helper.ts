import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { syncSchema } from '$lib/server/db/schema-sync';

export interface TestDatabase {
	sqlite: ReturnType<typeof Database>;
	db: ReturnType<typeof drizzle>;
}

export function createTestDb(): TestDatabase {
	const sqlite = new Database(':memory:');
	const db = drizzle(sqlite, { schema });
	syncSchema(sqlite);
	return { sqlite, db };
}

export function destroyTestDb(testDb: TestDatabase) {
	testDb.sqlite.close();
}

const CORE_TABLES = [
	'scoringProfiles',
	'customFormats',
	'blockedMedia',
	'downloadClients',
	'movies',
	'movieFiles',
	'series',
	'seasons',
	'episodes',
	'episodeFiles',
	'downloadQueue'
] as const;

export function clearTestDb(testDb: TestDatabase) {
	for (const table of CORE_TABLES) {
		testDb.db.delete(schema[table]).run();
	}
}
