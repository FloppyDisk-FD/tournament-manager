import { WaffoPancake, TaxCategory } from '@waffo/pancake-ts';

/**
 * Waffo Pancake 网关客户端工厂与懒初始化。
 *
 * 集成只需要两个必需环境变量（见 docs.waffo.ai SKILL.md）：
 *   - WAFFO_MERCHANT_ID    商户 ID（Dashboard → API & Development 顶部，非 storeId）
 *   - WAFFO_PRIVATE_KEY    RSA 私钥（Dashboard → API & Development → API Keys）
 *
 * 可选（运行时自动创建后可固化）：
 *   - WAFFO_STORE_ID       Store 短 ID（STO_…，未配置时用 SDK 自动创建）
 *   - WAFFO_PRODUCT_ID     一次性商品 ID（PROD_…，未配置时自动创建）
 *
 * 未配置必需变量时返回 null，支付端点自动回退到 mock 支付。
 */
export function getWaffoClient(): WaffoPancake | null {
	const merchantId = process.env.WAFFO_MERCHANT_ID;
	const privateKey = process.env.WAFFO_PRIVATE_KEY;
	if (!merchantId || !privateKey) return null;
	return new WaffoPancake({ merchantId, privateKey });
}

/** 是否已配置 Waffo 网关（决定 /pay 走真实网关还是 mock） */
export function waffoConfigured(): boolean {
	return Boolean(process.env.WAFFO_MERCHANT_ID && process.env.WAFFO_PRIVATE_KEY);
}

let cachedSetup: { storeId: string; productId: string } | null = null;

/**
 * 确保 store 与一次性商品存在（进程内缓存）。
 * 优先读 env；缺失时用 SDK 在测试环境自动创建。
 */
export async function ensureWaffoSetup(client: WaffoPancake): Promise<{ storeId: string; productId: string }> {
	if (cachedSetup) return cachedSetup;

	const storeId = process.env.WAFFO_STORE_ID;
	const productId = process.env.WAFFO_PRODUCT_ID;
	if (storeId && productId) {
		cachedSetup = { storeId, productId };
		return cachedSetup;
	}

	let sid = storeId;
	if (!sid) {
		const { store } = await client.stores.create({ name: 'Tournament Manager' });
		sid = store.id;
	}

	let pid = productId;
	if (!pid) {
		// 默认价 0.01 只是占位：checkout 时用 priceSnapshot 覆盖真实金额
		const { product } = await client.onetimeProducts.create({
			storeId: sid,
			name: 'Tournament Registration Fee',
			prices: { CNY: { amount: '0.01', taxCategory: TaxCategory.DigitalGoods } },
		});
		pid = product.id;
	}

	cachedSetup = { storeId: sid, productId: pid };
	console.log(`[waffo] setup ready — store=${sid} product=${pid}（可固化到 WAFFO_STORE_ID / WAFFO_PRODUCT_ID）`);
	return cachedSetup;
}

/** 以当前支付单创建 checkout session，返回跳转链接。amount 为元。 */
export async function createWaffoCheckout(client: WaffoPancake, params: {
	paymentId: string;
	tournamentId: string;
	amount: number;
	successUrl?: string;
}): Promise<{ sessionId: string; checkoutUrl: string; expiresAt: string }> {
	const { productId } = await ensureWaffoSetup(client);
	const session = await client.checkout.anonymous.create({
		productId,
		currency: 'CNY',
		priceSnapshot: {
			amount: params.amount.toFixed(2),
			taxCategory: TaxCategory.DigitalGoods,
		},
		orderMerchantExternalId: `pay-${params.paymentId}`,
		metadata: { paymentId: params.paymentId, tournamentId: params.tournamentId },
		...(params.successUrl ? { successUrl: params.successUrl } : {}),
	});
	return session;
}

/**
 * 主动查询 Waffo 订单状态（按 orderMerchantExternalId = `pay-{paymentId}`）。
 * 用于本地开发没有 webhook 隧道、或 webhook 回调丢失时兜底同步订单状态。
 * 返回 null 表示订单不存在（可能尚未创建或查询失败）。
 */
export async function queryWaffoOrder(client: WaffoPancake, paymentId: string): Promise<{
	status: string;
	orderId: string;
} | null> {
	const result = await client.graphql.query<{
		orders: Array<{ id: string; status: string; orderMerchantExternalId: string | null }>;
	}>({
		query: `query { orders { id status orderMerchantExternalId } }`,
	});
	const order = (result.data?.orders ?? []).find((o) => o.orderMerchantExternalId === `pay-${paymentId}`);
	if (!order) return null;
	return { status: order.status, orderId: order.id };
}
