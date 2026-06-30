import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Read .env manually
import { readFileSync } from 'fs';
const envContent = readFileSync('./.env', 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    // Remove surrounding quotes
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
    process.env[key] = val;
  }
}

console.log('DB URL (masked):', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NOT SET');

// Inline schema for users table
const roleEnum = pgEnum('role', ['admin', 'user']);
const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash').notNull(),
  role: roleEnum('role').notNull().default('user'),
  avatarUrl: varchar('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

const connectionString = process.env.DATABASE_URL;
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
