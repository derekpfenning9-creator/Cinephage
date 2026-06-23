import type { ReleaseAttributes } from './types.js';
import { parseRelease } from './scorer.js';

export interface StoredQuality {
	resolution?: string;
	source?: string;
	codec?: string;
	hdr?: string;
}

export interface ExistingFileRecord {
	sceneName?: string | null;
	relativePath: string;
	quality?: StoredQuality | null;
	releaseGroup?: string | null;
}

export function buildExistingAttrs(
	existingFile: ExistingFileRecord
): ReleaseAttributes | undefined {
	const quality = existingFile.quality;
	const sceneName = existingFile.sceneName || existingFile.relativePath;

	const UNKNOWN_VALUES = new Set(['unknown', 'undefined', '']);

	const hasStoredQuality =
		quality &&
		((quality.resolution && !UNKNOWN_VALUES.has(quality.resolution)) ||
			(quality.source && !UNKNOWN_VALUES.has(quality.source)) ||
			(quality.codec && !UNKNOWN_VALUES.has(quality.codec)) ||
			(quality.hdr && !UNKNOWN_VALUES.has(quality.hdr)));

	if (!hasStoredQuality) {
		return undefined;
	}

	const attrs = parseRelease(sceneName);

	if (quality.resolution && !UNKNOWN_VALUES.has(quality.resolution)) {
		attrs.resolution = quality.resolution as ReleaseAttributes['resolution'];
	}
	if (quality.source && !UNKNOWN_VALUES.has(quality.source)) {
		attrs.source = quality.source as ReleaseAttributes['source'];
	}
	if (quality.codec && !UNKNOWN_VALUES.has(quality.codec)) {
		attrs.codec = quality.codec as ReleaseAttributes['codec'];
	}
	if (quality.hdr && !UNKNOWN_VALUES.has(quality.hdr)) {
		attrs.hdr = quality.hdr as ReleaseAttributes['hdr'];
	}

	if (existingFile.releaseGroup && existingFile.releaseGroup !== 'Streaming') {
		attrs.releaseGroup = existingFile.releaseGroup;
	}

	return attrs;
}
