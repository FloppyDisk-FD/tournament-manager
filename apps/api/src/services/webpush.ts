/**
 * Web Push 协议层（RFC 8291 + VAPID）
 *
 * 纯 Web Crypto 实现（无 Node 依赖），Bun 本地与 Cloudflare Workers 通用：
 * - VAPID：ES256 (P-256) JWT 签名，Authorization: vapid t=<jwt>, k=<publicKey>
 * - 消息加密：ECDH(P-256) + HKDF-SHA256 + AES-128-GCM，Content-Encoding: aes128gcm
 */

const encoder = new TextEncoder();

/** Uint8Array → base64url（无 padding） */
export function b64url(buf: Uint8Array | ArrayBuffer): string {
	const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → Uint8Array */
export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
	let t = s.replace(/-/g, '+').replace(/_/g, '/');
	while (t.length % 4) t += '=';
	const bin = atob(t);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

/** HKDF-SHA256 派生 */
async function hkdf(
	ikm: Uint8Array<ArrayBuffer>,
	salt: Uint8Array<ArrayBuffer>,
	info: Uint8Array<ArrayBuffer>,
	length: number,
): Promise<Uint8Array<ArrayBuffer>> {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt, info },
		key,
		length * 8,
	);
	return new Uint8Array(bits);
}

export interface VapidKeys {
	publicKey: string; // 65 字节 uncompressed P-256 点，base64url
	privateKey: string; // 32 字节 P-256 私钥，base64url
}

/** 生成 VAPID 密钥对（供部署脚本/一次性初始化使用） */
export async function generateVapidKeys(): Promise<VapidKeys> {
	const kp = await crypto.subtle.generateKey(
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true,
		['sign'],
	);
	const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
	const x = b64urlDecode(jwk.x!);
	const y = b64urlDecode(jwk.y!);
	const d = b64urlDecode(jwk.d!);
	const pub = new Uint8Array(65);
	pub[0] = 4;
	pub.set(x, 1);
	pub.set(y, 33);
	return { publicKey: b64url(pub), privateKey: b64url(d) };
}

/** 导入 VAPID 签名私钥（ECDSA P-256, JWK） */
async function importVapidSigningKey(keys: VapidKeys): Promise<CryptoKey> {
	const rawPub = b64urlDecode(keys.publicKey);
	const jwk = {
		kty: 'EC',
		crv: 'P-256',
		x: b64url(rawPub.slice(1, 33)),
		y: b64url(rawPub.slice(33, 65)),
		d: keys.privateKey,
	};
	return crypto.subtle.importKey(
		'jwk',
		jwk,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign'],
	);
}

/** 创建 VAPID JWT（ES256，aud = 推送服务 origin） */
async function createVapidJwt(
	aud: string,
	subject: string,
	key: CryptoKey,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { typ: 'JWT', alg: 'ES256' };
	const payload = { aud, exp: now + 12 * 3600, sub: subject };
	const toSign = `${b64url(encoder.encode(JSON.stringify(header)))}.${b64url(
		encoder.encode(JSON.stringify(payload)),
	)}`;
	const sig = new Uint8Array(
		await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(toSign)),
	);
	return `${toSign}.${b64url(sig)}`;
}

export interface PushSubscriptionKeys {
	p256dh: string; // 客户端公钥，base64url
	auth: string; // auth secret，base64url
}

/**
 * 加密推送消息（RFC 8291 aes128gcm）
 * 返回 [完整密文（含 salt/rs/idlen/keyid 头）, 服务器公钥]
 */
export async function encryptPayload(
	payload: string,
	sub: PushSubscriptionKeys,
): Promise<{ ciphertext: Uint8Array<ArrayBuffer>; asPublic: Uint8Array<ArrayBuffer> }> {
	const uaPublic = b64urlDecode(sub.p256dh);
	const authSecret = b64urlDecode(sub.auth);

	const ecdh = await crypto.subtle.generateKey(
		{ name: 'ECDH', namedCurve: 'P-256' },
		true,
		['deriveBits'],
	);
	const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ecdh.publicKey));

	const uaKey = await crypto.subtle.importKey(
		'raw',
		uaPublic,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[],
	);
	const shared = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, ecdh.privateKey, 256),
	);

	// IKM = HKDF(auth_secret, shared_secret, "WebPush: info" || ua_public || as_public, 32)
	const info = new Uint8Array([
		...encoder.encode('WebPush: info'),
		...uaPublic,
		...asPublic,
	]);
	const ikm = await hkdf(authSecret, shared, info, 32);

	const salt = crypto.getRandomValues(new Uint8Array(16));

	// 2 字节 padding 长度（0）+ 载荷
	const body = encoder.encode(payload);
	const padded = new Uint8Array(body.length + 2);
	padded.set(body, 2);

	const cek = await hkdf(ikm, salt, encoder.encode('Content-Encoding: aes128gcm'), 16);
	const nonce = await hkdf(ikm, salt, encoder.encode('Content-Encoding: nonce'), 12);

	const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, [
		'encrypt',
	]);
	const ct = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, padded),
	);

	const rs = 4096;
	const header = new Uint8Array([
		...salt,
		(rs >> 24) & 0xff,
		(rs >> 16) & 0xff,
		(rs >> 8) & 0xff,
		rs & 0xff,
		asPublic.length,
		...asPublic,
	]);

	return { ciphertext: new Uint8Array([...header, ...ct]), asPublic };
}

export interface VapidConfig extends VapidKeys {
	subject: string; // VAPID sub，形如 mailto:xxx
}

/**
 * 发送一条推送
 * @returns 'ok' 成功；'gone' 订阅失效（410/404），调用方应删除订阅
 */
export async function sendPush(
	endpoint: string,
	payload: Uint8Array<ArrayBuffer>,
	vapid: VapidConfig,
): Promise<'ok' | 'gone'> {
	const aud = new URL(endpoint).origin;
	const signKey = await importVapidSigningKey(vapid);
	const jwt = await createVapidJwt(aud, vapid.subject, signKey);

	const res = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Encoding': 'aes128gcm',
			'Content-Type': 'application/octet-stream',
			TTL: '86400',
			Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
		},
		body: payload,
	});

	if (res.status === 410 || res.status === 404) return 'gone';
	if (!res.ok) {
		throw new Error(`push failed: ${res.status} ${res.statusText}`);
	}
	return 'ok';
}
