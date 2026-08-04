import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import type { Db } from '../db';
import { users, registrations, tournaments } from '../db/schema';
import { AppError, requireUuid } from '../middleware/error';

// 公开用户主页（/api/v1/users，无需登录）
export const userProfileRoutes = new Hono<{ Variables: { user: any | null; db: Db } }>();

userProfileRoutes.get('/:userId/profile', async (c) => {
  const { userId } = c.req.param();
  requireUuid(userId, '用户');
  const db = c.get('db');
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError('NOT_FOUND', '用户不存在', 404);

  // 参赛记录（含赛事信息）
  const regs = await db
    .select({
      id: registrations.id,
      tournamentId: registrations.tournamentId,
      teamId: registrations.teamId,
      teamName: registrations.teamName,
      logoEmoji: registrations.logoEmoji,
      logoUrl: registrations.logoUrl,
      status: registrations.status,
      createdAt: registrations.createdAt,
      tournamentName: tournaments.name,
      tournamentStatus: tournaments.status,
    })
    .from(registrations)
    .innerJoin(tournaments, eq(registrations.tournamentId, tournaments.id))
    .where(eq(registrations.userId, userId))
    .orderBy(desc(registrations.createdAt));

  // 主办/创建的赛事
  const hosted = await db
    .select({ id: tournaments.id, name: tournaments.name, status: tournaments.status, createdAt: tournaments.createdAt })
    .from(tournaments)
    .where(eq(tournaments.createdBy, userId))
    .orderBy(desc(tournaments.createdAt));

  return c.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    registrations: regs,
    hosted,
  });
});
