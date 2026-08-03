/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface PushData {
	title?: string;
	body?: string;
	url?: string;
}

self.addEventListener('push', (event) => {
	let data: PushData = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		/* 非 JSON 载荷忽略字段 */
	}
	const title = data.title || '新通知';
	event.waitUntil(
		self.registration.showNotification(title, {
			body: data.body || '',
			data: { url: data.url || '/' },
		}),
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data as { url?: string } | undefined)?.url || '/';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
			for (const client of list) {
				if ('focus' in client) {
					client.navigate(url);
					return client.focus();
				}
			}
			return self.clients.openWindow(url);
		}),
	);
});
