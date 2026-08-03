/**
 * 生成 VAPID 密钥对并写入本地 .env（Bun 本地开发用）。
 * 部署 Cloudflare Workers 时执行：
 *   wrangler secret put VAPID_PUBLIC_KEY  < 值
 *   wrangler secret put VAPID_PRIVATE_KEY < 值
 * 运行：bun run scripts/gen-vapid.ts
 */
import { writeFileSync, existsSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateVapidKeys } from '../src/services/webpush';

const keys = await generateVapidKeys();

const envPath = join(import.meta.dir, '..', '.env');
const lines = [`VAPID_PUBLIC_KEY=${keys.publicKey}`, `VAPID_PRIVATE_KEY=${keys.privateKey}`];

if (!existsSync(envPath)) {
	writeFileSync(envPath, lines.join('\n') + '\n');
} else {
	const existing = readFileSync(envPath, 'utf8');
	const next = [...lines, existing].filter((l, i, arr) => arr.indexOf(l) === i).join('\n');
	writeFileSync(envPath, next);
}

console.log('✅ VAPID 密钥已写入 .env');
console.log('部署到 Cloudflare Workers：');
console.log(`  wrangler secret put VAPID_PUBLIC_KEY  # ${keys.publicKey}`);
console.log(`  wrangler secret put VAPID_PRIVATE_KEY # ${keys.privateKey}`);
console.log('（可选）wrangler secret put VAPID_SUBJECT # mailto:your@email.com');
