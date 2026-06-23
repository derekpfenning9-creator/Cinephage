/**
 * Downloads module - services for handling download resolution and management.
 */

export {
	getDownloadResolutionService,
	resetDownloadResolutionService,
	type ResolveDownloadInput,
	type ResolvedDownload
} from './DownloadResolutionService';

export {
	getCascadingSearchStrategy,
	resetCascadingSearchStrategy,
	CascadingSearchStrategy,
	type EpisodeToSearch,
	type SeriesData,
	type EpisodeSearchResult,
	type SeasonPackGrab,
	type CascadingSearchOptions,
	type CascadingSearchResult
} from './CascadingSearchStrategy';
