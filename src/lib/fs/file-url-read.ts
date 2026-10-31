/**
 * Reading file:// URLs from the extension page. Chrome allows it once the user turns on
 * "Allow access to file URLs"; some builds only allow it through XMLHttpRequest, so fetch
 * is tried first and XHR second. Firefox allows neither: callers get `null` and fall back.
 */

function readWithXhr(url: string): Promise<Blob | null> {
	return new Promise((resolve) => {
		try {
			const request = new XMLHttpRequest();
			request.open('GET', url);
			request.responseType = 'blob';
			// file:// responses report status 0 on success.
			request.onload = () =>
				resolve(request.status === 0 || request.status === 200 ? (request.response as Blob) : null);
			request.onerror = () => resolve(null);
			request.send();
		} catch {
			resolve(null);
		}
	});
}

export async function readFileUrlBlob(url: string): Promise<Blob | null> {
	try {
		const response = await fetch(url, { cache: 'no-store' });
		if (response.ok) return await response.blob();
	} catch {
		// Fall through to XHR.
	}
	return readWithXhr(url);
}

export async function readFileUrlText(url: string): Promise<string | null> {
	const blob = await readFileUrlBlob(url);
	return blob ? blob.text() : null;
}
