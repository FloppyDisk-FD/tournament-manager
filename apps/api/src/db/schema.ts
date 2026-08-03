import {
  pgTable, uuid, varchar, text, integer, boolean, timestamp,
  jsonb, pgEnum, serial,
} from 'drizzle-orm/pg-core';
import { relations, InferSelectModel } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['admin', 'tournament_manager', 'team_manager', 'user']);
export const tournamentStatusEnum = pgEnum('tournament_status', ['draft', 'ongoing', 'completed', 'cancelled']);
export const tournamentFormatEnum = pgEnum('tournament_format', ['single_elim', 'double_elim', 'swiss', 'round_robin']);
export const teamStatusEnum = pgEnum('team_status', ['active', 'eliminated', 'withdrawn']);
export const stageTypeEnum = pgEnum('stage_type', ['group', 'winners_bracket', 'losers_bracket', 'grand_final', 'round_robin', 'swiss']);
export const matchStatusEnum = pgEnum('match_status', ['pending', 'in_progress', 'completed', 'walkthrough']);

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash').notNull(),
  role: roleEnum('role').notNull().default('user'),
  avatarUrl: varchar('avatar_url'),
  displayName: varchar('display_name', { length: 50 }),
  bio: text('bio'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tournaments: many(tournaments),
}));

// Tournaments
export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull().default(''),
  game: varchar('game', { length: 100 }).notNull(),
  coverImage: varchar('cover_image'),
  status: tournamentStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  format: tournamentFormatEnum('format').notNull(),
  teamSize: integer('team_size').notNull().default(5),
  maxTeams: integer('max_teams').notNull().default(16),
  boCount: integer('bo_count').notNull().default(3),
  hasGroupStage: boolean('has_group_stage').notNull().default(false),
  groupCount: integer('group_count'),
  advancePerGroup: integer('advance_per_group'),
  thirdPlace: boolean('third_place').notNull().default(false),
  swissRounds: integer('swiss_rounds'),
  liveUrl: varchar('live_url', { length: 500 }),
  entryFee: integer('entry_fee').notNull().default(0),
  formatConfig: jsonb('format_config'),
});

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  creator: one(users, { fields: [tournaments.createdBy], references: [users.id] }),
  teams: many(teams),
  stages: many(stages),
  standings: many(standings),
}));

// Teams — 全局队伍库（tournamentId 可空，全局队伍为 null）
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').references(() => tournaments.id),
  ownerId: uuid('owner_id').references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  seed: integer('seed'),
  logoUrl: varchar('logo_url'),
  logoEmoji: varchar('logo_emoji', { length: 10 }),
  status: teamStatusEnum('status').notNull().default('active'),
});

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [teams.tournamentId], references: [tournaments.id] }),
  players: many(teamPlayers),
  tournamentEntries: many(tournamentTeams),
}));

// 赛事-队伍关联表（全局队伍加入赛事时创建，记录赛事内的 seed/status）
export const tournamentTeams = pgTable('tournament_teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  seed: integer('seed'),
  status: teamStatusEnum('status').notNull().default('active'),
  groupLabel: varchar('group_label', { length: 20 }),
  checkedIn: boolean('checked_in').notNull().default(false),
  checkedInAt: timestamp('checked_in_at'),
});

export const tournamentTeamsRelations = relations(tournamentTeams, ({ one }) => ({
  tournament: one(tournaments, { fields: [tournamentTeams.tournamentId], references: [tournaments.id] }),
  team: one(teams, { fields: [tournamentTeams.teamId], references: [teams.id] }),
}));

// Team Players — 完整选手档案
export const teamPlayers = pgTable('team_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  playerName: varchar('player_name', { length: 50 }).notNull(),
  playerRole: varchar('player_role', { length: 30 }),
  gameId: varchar('game_id', { length: 50 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  isCaptain: boolean('is_captain').notNull().default(false),
});

export const teamPlayersRelations = relations(teamPlayers, ({ one }) => ({
  team: one(teams, { fields: [teamPlayers.teamId], references: [teams.id] }),
}));

// Stages
export const stages = pgTable('stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  type: stageTypeEnum('type').notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  order: integer('order').notNull(),
});

export const stagesRelations = relations(stages, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [stages.tournamentId], references: [tournaments.id] }),
  matches: many(matches),
}));

// Matches
export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id').notNull().references(() => stages.id),
  groupLabel: varchar('group_label', { length: 20 }),
  round: integer('round').notNull(),
  position: integer('position').notNull(),
  bracketPos: integer('bracket_pos'),
  team1Id: uuid('team1_id').references(() => teams.id),
  team2Id: uuid('team2_id').references(() => teams.id),
  winnerId: uuid('winner_id').references(() => teams.id),
  loserId: uuid('loser_id').references(() => teams.id),
  team1Score: integer('team1_score').notNull().default(0),
  team2Score: integer('team2_score').notNull().default(0),
  status: matchStatusEnum('status').notNull().default('pending'),
  scheduledAt: timestamp('scheduled_at'),
  nextMatchId: uuid('next_match_id'),
  nextLosersMatchId: uuid('next_losers_match_id'),
  swissScoreGroup: integer('swiss_score_group'),
});

export const matchesRelations = relations(matches, ({ one, many }) => ({
  stage: one(stages, { fields: [matches.stageId], references: [stages.id] }),
  team1: one(teams, { fields: [matches.team1Id], references: [teams.id], relationName: 'team1' }),
  team2: one(teams, { fields: [matches.team2Id], references: [teams.id], relationName: 'team2' }),
  winner: one(teams, { fields: [matches.winnerId], references: [teams.id], relationName: 'winner' }),
  loser: one(teams, { fields: [matches.loserId], references: [teams.id], relationName: 'loser' }),
  nextMatch: one(matches, { fields: [matches.nextMatchId], references: [matches.id], relationName: 'nextMatch' }),
  nextLosersMatch: one(matches, { fields: [matches.nextLosersMatchId], references: [matches.id], relationName: 'nextLosersMatch' }),
  games: many(games),
}));

// Games
export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  gameNumber: integer('game_number').notNull(),
  winnerId: uuid('winner_id').references(() => teams.id),
  score: jsonb('score'),
  duration: integer('duration'),
  map: varchar('map', { length: 100 }),
  vodUrl: varchar('vod_url'),
});

export const gamesRelations = relations(games, ({ one }) => ({
  match: one(matches, { fields: [games.matchId], references: [matches.id] }),
  winner: one(teams, { fields: [games.winnerId], references: [teams.id] }),
}));

// Standings
export const standings = pgTable('standings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  stageId: uuid('stage_id').notNull().references(() => stages.id),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  groupLabel: varchar('group_label', { length: 20 }),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
  draws: integer('draws').notNull().default(0),
  points: integer('points').notNull().default(0),
  gameDifference: integer('game_difference').notNull().default(0),
  roundPlayed: integer('round_played').notNull().default(0),
  rank: integer('rank'),
});

export const standingsRelations = relations(standings, ({ one }) => ({
  tournament: one(tournaments, { fields: [standings.tournamentId], references: [tournaments.id] }),
  stage: one(stages, { fields: [standings.stageId], references: [stages.id] }),
  team: one(teams, { fields: [standings.teamId], references: [teams.id] }),
}));

// Inferred types from table definitions
export type User = InferSelectModel<typeof users>;
export type Tournament = InferSelectModel<typeof tournaments>;
export type Team = InferSelectModel<typeof teams>;
export type Stage = InferSelectModel<typeof stages>;
export type Match = InferSelectModel<typeof matches>;
export type Game = InferSelectModel<typeof games>;
export type Standing = InferSelectModel<typeof standings>;

// Registrations — 选手自助报名（登录后提交，主办方审核）
export const registrationStatusEnum = pgEnum('registration_status', ['pending', 'approved', 'rejected']);

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'refunded']);

export const registrations = pgTable('registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  teamId: uuid('team_id').references(() => teams.id),
  teamName: varchar('team_name', { length: 100 }).notNull(),
  logoEmoji: varchar('logo_emoji', { length: 10 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  players: jsonb('players').notNull().default([]),
  status: registrationStatusEnum('status').notNull().default('pending'),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

export const registrationsRelations = relations(registrations, ({ one }) => ({
  tournament: one(tournaments, { fields: [registrations.tournamentId], references: [tournaments.id] }),
  user: one(users, { fields: [registrations.userId], references: [users.id] }),
}));

// Payments — 报名费订单（provider = 'mock' 为模拟支付，后续可换微信/支付宝适配层）
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  registrationId: uuid('registration_id').notNull().references(() => registrations.id, { onDelete: 'cascade' }),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  provider: varchar('provider', { length: 20 }).notNull().default('mock'),
  providerOrderId: varchar('provider_order_id', { length: 100 }),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  registration: one(registrations, { fields: [payments.registrationId], references: [registrations.id] }),
  tournament: one(tournaments, { fields: [payments.tournamentId], references: [tournaments.id] }),
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));

// Notifications — 站内通知（报名状态变化等）
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 30 }).notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  message: text('message').notNull().default(''),
  link: varchar('link', { length: 200 }),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// Push Subscriptions — Web Push 系统级提醒订阅
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));
