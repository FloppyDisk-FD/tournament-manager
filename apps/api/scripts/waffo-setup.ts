/**
 * 一次性脚本：确保 Waffo store/product 存在，并注册 order.completed webhook（test 模式）。
 * 用法：bun --env-file=.env run scripts/waffo-setup.ts <webhook-url>
 * 创建出的 storeId/productId 会追加到 .env（已有则跳过）。
 */
import { WaffoPancake, WebhookEventType } from '@waffo/pancake-ts';
import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const webhookUrl = process.argv[2];
if (!webhookUrl) {
	console.error('用法: bun --env-file=.env run scripts/waffo-setup.ts <webhook-url>');
	process.exit(1);
}

const merchantId = process.env.WAFFO_MERCHANT_ID!;
const privateKey = process.env.WAFFO_PRIVATE_KEY!;
if (!merchantId || !privateKey) {
	console.error('缺少 WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY');
	process.exit(1);
}

const client = new WaffoPancake({ merchantId, privateKey });
const envPath = join(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf8');
const hasStore = /^WAFFO_STORE_ID=./m.test(envContent);
const hasProduct = /^WAFFO_PRODUCT_ID=./m.test(envContent);

let storeId = process.env.WAFFO_STORE_ID;
let productId = process.env.WAFFO_PRODUCT_ID;

if (!storeId) {
	const { store } = await client.stores.create({ name: 'Tournament Manager' });
	storeId = store.id;
	if (!hasStore) appendFileSync(envPath, `\nWAFFO_STORE_ID=${storeId}\n`);
	console.log(`[setup] store 已创建/使用: ${storeId}`);
}

if (!productId) {
	const { product } = await client.onetimeProducts.create({
		storeId,
		name: 'Tournament Registration Fee',
		prices: { CNY: { amount: '0.01', taxCategory: 'digital_goods' } },
	});
	productId = product.id;
	if (!hasProduct) appendFileSync(envPath, `\nWAFFO_PRODUCT_ID=${productId}\n`);
	console.log(`[setup] product 已创建/使用: ${productId}`);
}

// 注册 webhook（test 模式）
const { webhook } = await client.webhooks.add({
	storeId,
	channel: 'http',
	url: webhookUrl,
	events: [WebhookEventType.OrderCompleted],
	testMode: true,
});
console.log(`[setup] webhook 已注册: ${webhook.id} → ${webhookUrl}`);
