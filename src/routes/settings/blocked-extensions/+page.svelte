<script lang="ts">
	import { SettingsPage, SettingsSection } from '$lib/components/ui/settings';
	import { updateBlockedExtensions } from '$lib/api/settings.js';
	import { toasts } from '$lib/stores/toast.svelte';

	let { data } = $props();

	let blocked = $state<string[]>([]);
	let saving = $state(false);

	$effect(() => {
		blocked = [...data.blockedExtensions];
	});

	function toggleExtension(ext: string, checked: boolean) {
		if (checked) {
			if (!blocked.includes(ext)) {
				blocked = [...blocked, ext];
			}
		} else {
			blocked = blocked.filter((e) => e !== ext);
		}
	}

	function isBlocked(ext: string): boolean {
		return blocked.includes(ext);
	}

	async function handleSave() {
		saving = true;
		try {
			await updateBlockedExtensions({ extensions: blocked });
			toasts.success('Blocked extensions saved');
		} catch {
			toasts.error('Failed to save blocked extensions');
		} finally {
			saving = false;
		}
	}
</script>

<SettingsPage
	title="Blocked Extensions"
	subtitle="Prevent releases with these file extensions from appearing in search results. Checked extensions are blocked."
>
	<SettingsSection
		title="Dangerous & Executable Extensions"
		description="Releases containing these extensions in their title will be immediately excluded from all search results."
	>
		<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
			{#each data.availableExtensions as ext}
				<label class="label cursor-pointer justify-start gap-2">
					<input
						type="checkbox"
						class="checkbox checkbox-sm checkbox-warning"
						checked={isBlocked(ext)}
						onchange={(e) => toggleExtension(ext, e.currentTarget.checked)}
					/>
					<span class="label-text font-mono">{ext}</span>
				</label>
			{/each}
		</div>
	</SettingsSection>

	<button class="btn mt-4 btn-primary" onclick={handleSave} disabled={saving}>
		{saving ? 'Saving...' : 'Save'}
	</button>
</SettingsPage>
