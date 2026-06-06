<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import MediaHero from '$lib/components/tmdb/MediaHero.svelte';
	import PersonCard from '$lib/components/tmdb/PersonCard.svelte';
	import SectionRow from '$lib/components/discover/SectionRow.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{m.discover_movie_pageTitle({ title: data.movie.title })}</title>
</svelte:head>

{#if data.hasBlockedKeywords}
	<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
		<h1 class="text-3xl font-bold">{data.movie.title}</h1>
		<p class="mt-4 text-base-content/70">
			This content matches keywords you have blocked. It has been hidden from view.
		</p>
		<div class="mt-6 flex gap-4">
			<a href="/settings/blocklist/blocked-keywords" class="btn btn-outline btn-sm">
				Manage blocked keywords
			</a>
			<a href="/discover" class="btn btn-sm btn-primary"> Back to discover </a>
		</div>
	</div>
{:else}
	<div class="flex w-full flex-col gap-12 px-4 pb-20 lg:px-8">
		<!-- Hero Section -->
		<MediaHero item={data.movie} />

		<!-- Cast Section -->
		{#if data.movie.credits.cast.length > 0}
			<SectionRow
				title={m.discover_movie_topCast()}
				items={data.movie.credits.cast.slice(0, 15)}
				itemClass="w-[30vw] sm:w-36 md:w-44"
			>
				{#snippet cardSnippet(person)}
					<PersonCard {person} />
				{/snippet}
			</SectionRow>
		{/if}

		<!-- Collection Section -->
		{#if data.collection && data.collection.parts}
			<SectionRow
				title={data.collection.name}
				items={data.collection.parts.sort(
					(a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
				)}
			/>
		{/if}

		<!-- Recommendations -->
		{#if data.movie.recommendations.results.length > 0}
			<SectionRow
				title={m.discover_movie_recommendations()}
				items={data.movie.recommendations.results}
				endpoint={`movie/${data.movie.id}/recommendations`}
			/>
		{/if}

		<!-- Similar -->
		{#if data.movie.similar.results.length > 0}
			<SectionRow
				title={m.discover_movie_similarTitles()}
				items={data.movie.similar.results}
				endpoint={`movie/${data.movie.id}/similar`}
			/>
		{/if}
	</div>
{/if}
