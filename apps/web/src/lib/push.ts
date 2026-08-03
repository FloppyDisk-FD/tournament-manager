import { api } from '$lib/api/client';

/** Web Push 系统级提醒的浏览器端订阅管理 */

export function isPushSupported(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

/** base64url → Uint8Array（VAPID 公钥转换用） */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const b64 = base64.replace(/-/g, '+').replace(/_/g, '/') + padding;
	const raw = atob(b64);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

async function getVapidPublicKey(): Promise<string | null> {
	try {
		const res = await api.get<{ publicKey: string }>('/push/vapid-public-key');
		return res.publicKey ?? null;
	} catch {
		return null;
	}
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
	if (!isPushSupported()) return null;
	try {
		const reg = await navigator.serviceWorker.ready;
		return reg.pushManager.getSubscription();
	} catch {
		return null;
	}
}

/** 开启：请求权限 → 订阅 → 保存到服务端。返回是否成功开启 */
export async function enablePush(): Promise<boolean> {
	if (!isPushSupported()) return false;
	if (!('serviceWorker' in navigator)) return false;

	// 确保 SW 已注册（SvelteKit 自动注册，这里兜底）
	try {
		await navigator.serviceWorker.register('/service-worker.js');
	} catch {
		/* 已注册则忽略 */
	}

	let permission: NotificationPermission;
	try {
		permission = await Notification.requestPermission();
	} catch {
		return false;
	}
	if (permission !== 'granted') return false;

	const key = await getVapidPublicKey();
	if (!key) return false;

	const reg = await navigator.serviceWorker.ready;
	let sub = await reg.pushManager.getSubscription();
	if (!sub) {
		sub = await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(key),
		});
	}

	const data = sub.toJSON();
	if (!data.endpoint || !data.keys?.p256dh || !data.keys?.auth) return false;

	await api.post('/push/subscriptions', {
		endpoint: data.endpoint,
		p256dh: data.keys.p256dh,
		auth: data.keys.auth,
	});
	return true;
}

/** 关闭：取消订阅并移除服务端记录 */
export async function disablePush(): Promise<void> {
	if (!isPushSupported()) return;
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (sub) {
			const endpoint = sub.endpoint;
			await sub.unsubscribe();
			await api.del('/push/subscriptions', { endpoint }).catch(() => {});
		}
	} catch {
		/* 静默 */
	}
}
