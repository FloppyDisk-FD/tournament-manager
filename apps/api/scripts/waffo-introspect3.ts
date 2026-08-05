import { WaffoPancake } from '@waffo/pancake-ts';

const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID!,
  privateKey: process.env.WAFFO_PRIVATE_KEY!,
});

try {
  const r = await client.graphql.query<any>({
    query: `query { __type(name: "OnetimeOrder") { fields { name type { kind name ofType { kind name } } } } }`,
  });
  const fields = (r.data?.__type?.fields ?? []).map((f: any) => `${f.name}: ${f.type?.name ?? f.type?.ofType?.name ?? ''}`);
  console.log('OnetimeOrder FIELDS:', JSON.stringify(fields));
  if (r.errors) console.log('ERRORS:', JSON.stringify(r.errors));
} catch (e: any) {
  console.log('EXC:', e.message?.slice(0, 300));
}
