import type { PageServerLoad } from './$types';
import { getBlockedExtensions } from '$lib/server/settings/blocked-extensions.js';
import { BLOCKED_EXTENSION_DEFAULTS } from '$lib/validation/schemas.js';

export const load: PageServerLoad = async () => {
	const settings = await getBlockedExtensions();

	return {
		blockedExtensions: settings.extensions,
		availableExtensions: [...BLOCKED_EXTENSION_DEFAULTS]
	};
};
