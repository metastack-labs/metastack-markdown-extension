import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
	HANDOFF_KEY_PREFIX,
	HANDOFF_MAX_AGE_MS,
	HANDOFF_MAX_COUNT,
	type Handoff,
	handoffKey,
	type OpenFileUrlResponse,
	parseOpenFileUrlMessage,
	staleHandoffKeys,
	WORKSPACE_PATH,
	workspaceQueryForFileUrl,
} from '../lib/handoff.ts';

function workspaceUrl(query = ''): string {
	return `${browser.runtime.getURL(WORKSPACE_PATH)}${query}`;
}

async function openWorkspace(): Promise<void> {
	await browser.tabs.create({ url: workspaceUrl() });
}

async function pruneHandoffs(maxCount = HANDOFF_MAX_COUNT): Promise<void> {
	const stored = await browser.storage.local.get(null);
	const stale = staleHandoffKeys(stored, Date.now(), HANDOFF_MAX_AGE_MS, maxCount);
	if (stale.length > 0) await browser.storage.local.remove(stale);
}

async function storeHandoff(handoff: Omit<Handoff, 'createdAt'>): Promise<void> {
	const key = handoffKey(handoff.url);
	const record: Handoff = { ...handoff, createdAt: Date.now() };
	// Make room first, so a full storage area can never block opening files.
	await pruneHandoffs(HANDOFF_MAX_COUNT - 1);
	try {
		await browser.storage.local.set({ [key]: record });
	} catch {
		// Out of space: drop every other hand-off and try once more.
		const stored = await browser.storage.local.get(null);
		await browser.storage.local.remove(
			Object.keys(stored).filter((name) => name.startsWith(HANDOFF_KEY_PREFIX) && name !== key)
		);
		await browser.storage.local.set({ [key]: record });
	}
}

export default defineBackground(() => {
	browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
		const parsed = parseOpenFileUrlMessage(message);
		// Only our own content script, running on a file:// page, may hand off a file.
		if (!parsed || sender.id !== browser.runtime.id || !sender.url?.startsWith('file://')) return false;
		storeHandoff(parsed.handoff).then(
			() => {
				const response: OpenFileUrlResponse = {
					ok: true,
					workspaceUrl: workspaceUrl(workspaceQueryForFileUrl(parsed.handoff.url)),
				};
				sendResponse(response);
			},
			(error: unknown) => {
				const response: OpenFileUrlResponse = { ok: false, error: String(error) };
				sendResponse(response);
			}
		);
		return true;
	});

	(browser.action ?? browser.browserAction).onClicked.addListener(() => {
		void openWorkspace();
	});

	browser.commands.onCommand.addListener((command) => {
		if (command === 'open-workspace') void openWorkspace();
	});

	browser.runtime.onInstalled.addListener(({ reason }) => {
		if (reason === 'install') void openWorkspace();
	});

	void pruneHandoffs();
});
