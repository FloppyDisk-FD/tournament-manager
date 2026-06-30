import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
console.log('DB URL (masked):', connectionString ? connectionString.substring(0, 30) + '...' : 'NOT SET');

const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  
  // Try to update existing admin user
  const result = await db.update(users).set({ role: 'admin', passwordHash: hash }).where(eq(users.username, 'admin')).returning();
  console.log('Update result:', JSON.stringify(result));
  
  if (result.length === 0) {
    const [newUser] = await db.insert(users).values({ username: 'admin', passwordHash: hash, role: 'admin' }).returning();
    console.log('Created admin user:', JSON.stringify(newUser));
  }
  
  await client.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
