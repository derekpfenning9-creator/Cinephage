<script lang="ts">
	import { Loader2, Plus, X, Sparkles } from 'lucide-svelte';
	import { getSmartListHelpers } from '$lib/api/smartlists.js';
	import {
		getBlockedKeywords,
		addBlockedKeyword,
		removeBlockedKeyword,
		seedBlockedKeywords
	} from '$lib/api/settings.js';
	import { toasts } from '$lib/stores/toast.svelte';

	interface KeywordResult {
		id: number;
		name: string;
	}

	interface BlockedKeyword {
		id: number;
		keywordId: number;
		name: string;
		createdAt: string;
	}

	let blockedKeywords = $state<BlockedKeyword[]>([]);
	let loading = $state(true);

	let query = $state('');
	let searchResults = $state<KeywordResult[]>([]);
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;

	async function loadBlockedKeywords() {
		loading = true;
		try {
			blockedKeywords = await getBlockedKeywords();
		} finally {
			loading = false;
		}
	}

	async function searchKeywords() {
		if (query.length < 2) {
			searchResults = [];
			return;
		}
		searching = true;
		try {
			const res = await getSmartListHelpers({ helper: 'keywords', q: query });
			searchResults = Array.isArray(res) ? res : [];
		} finally {
			searching = false;
		}
	}

	function handleInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(searchKeywords, 300);
	}

	async function addKeyword(keyword: KeywordResult) {
		try {
			await addBlockedKeyword(keyword.id);
			query = '';
			searchResults = [];
			await loadBlockedKeywords();
			toasts.success(`Added "${keyword.name}" to blocked keywords`);
		} catch {
			toasts.error('Failed to add keyword');
		}
	}

	async function removeKeyword(id: number) {
		try {
			await removeBlockedKeyword(id);
			await loadBlockedKeywords();
			toasts.success('Keyword removed');
		} catch {
			toasts.error('Failed to remove keyword');
		}
	}

	let seeding = $state(false);

	async function handleSeedDefaults() {
		seeding = true;
		try {
			const result = await seedBlockedKeywords();
			if (result.added > 0) {
				toasts.success(`Added ${result.added} default NSFW keywords`);
				await loadBlockedKeywords();
			} else {
				toasts.success('All default keywords are already added');
			}
		} catch {
			toasts.error('Failed to seed default keywords');
		} finally {
			seeding = false;
		}
	}

	$effect(() => {
		loadBlockedKeywords();
	});
</script>

<div class="space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Blocked Keywords</h1>
			<p class="mt-1 text-sm text-base-content/60">
				Content matching these TMDB keywords will be hidden from discover and smartlist results.
			</p>
		</div>
		<button class="btn gap-2 btn-outline btn-sm" onclick={handleSeedDefaults} disabled={seeding}>
			{#if seeding}
				<Loader2 class="h-4 w-4 animate-spin" />
			{:else}
				<Sparkles class="h-4 w-4" />
			{/if}
			Add default NSFW keywords
		</button>
	</div>

	<div class="card border border-base-300 bg-base-200">
		<div class="card-body">
			<h2 class="card-title text-base">Add Keyword</h2>
			<div class="relative">
				<input
					type="text"
					bind:value={query}
					oninput={handleInput}
					placeholder="Search TMDB keywords..."
					class="input-bordered input input-sm w-full"
				/>
				{#if searching}
					<Loader2 class="absolute top-2 right-3 h-4 w-4 animate-spin" />
				{/if}
			</div>
			{#if searchResults.length > 0}
				<div class="mt-1 max-h-48 overflow-y-auto rounded-lg border border-base-300 bg-base-100">
					{#each searchResults as keyword (keyword.id)}
						<div
							class="flex items-center justify-between border-b border-base-200 p-2 last:border-0"
						>
							<span class="text-sm">{keyword.name}</span>
							<button
								type="button"
								class="btn btn-xs btn-primary"
								onclick={() => addKeyword(keyword)}
							>
								<Plus class="h-3 w-3" /> Add
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="card border border-base-300 bg-base-200">
		<div class="card-body">
			<h2 class="card-title text-base">
				Blocked Keywords ({blockedKeywords.length})
			</h2>
			{#if loading}
				<div class="flex justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin" />
				</div>
			{:else if blockedKeywords.length === 0}
				<div class="py-8 text-center text-base-content/50">
					No blocked keywords yet. Search above to add one.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>Keyword</th>
								<th>TMDB ID</th>
								<th>Added</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each blockedKeywords as kw (kw.id)}
								<tr>
									<td class="font-medium">{kw.name}</td>
									<td class="text-base-content/50">{kw.keywordId}</td>
									<td class="text-base-content/50">{new Date(kw.createdAt).toLocaleDateString()}</td
									>
									<td>
										<button
											class="btn btn-ghost btn-xs btn-error"
											onclick={() => removeKeyword(kw.id)}
										>
											<X class="h-3 w-3" /> Remove
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
