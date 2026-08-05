import { WaffoPancake } from '@waffo/pancake-ts';

const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});

try {
  const r = await client.graphql.query<any>({
    query: `query { onetimeOrders { id status } }`,
  });
  console.log('ORDERS:', JSON.stringify(r.data ?? null));
  if (r.errors) console.log('ERRORS:', JSON.stringify(r.errors));
} catch (e: any) {
  console.log('EXC:', e.message?.slice(0, 300));
}
