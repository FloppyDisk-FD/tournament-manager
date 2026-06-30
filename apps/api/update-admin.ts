import { db } from './src/db';
import { users } from './src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function main() {
  // Hash the password
  const hash = await bcrypt.hash('admin123', 10);
  
  // Try to update existing admin user
  const result = await db.update(users).set({ role: 'admin', passwordHash: hash }).where(eq(users.username, 'admin')).returning();
  console.log('Update result:', JSON.stringify(result));
  
  if (result.length === 0) {
    // No admin user exists, create one
    const [newUser] = await db.insert(users).values({ username: 'admin', passwordHash: hash, role: 'admin' }).returning();
    console.log('Created admin user:', JSON.stringify(newUser));
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
