import type { MigrationDefinition } from '../migration-helpers.js';
import { columnExists } from '../migration-helpers.js';

export const migration_v098: MigrationDefinition = {
	version: 98,
	name: 'add_indexer_categories',
	apply: (sqlite) => {
		if (!columnExists(sqlite, 'indexers', 'cached_categories')) {
			sqlite.prepare(`ALTER TABLE "indexers" ADD COLUMN "cached_categories" text`).run();
		}
		if (!columnExists(sqlite, 'indexers', 'additional_categories')) {
			sqlite.prepare(`ALTER TABLE "indexers" ADD COLUMN "additional_categories" text`).run();
		}
	}
};
