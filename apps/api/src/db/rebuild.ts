// 重建数据库：drop 所有表并重建（数据会丢失）
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { max: 1, prepare: false });

async function main() {
  console.log('Dropping all tables...');
  // 按依赖逆序 drop，加 CASCADE
  const dropSQL = `
    DROP TABLE IF EXISTS "games" CASCADE;
    DROP TABLE IF EXISTS "matches" CASCADE;
    DROP TABLE IF EXISTS "standings" CASCADE;
    DROP TABLE IF EXISTS "team_players" CASCADE;
    DROP TABLE IF EXISTS "tournament_teams" CASCADE;
    DROP TABLE IF EXISTS "teams" CASCADE;
    DROP TABLE IF EXISTS "stages" CASCADE;
    DROP TABLE IF EXISTS "tournaments" CASCADE;
    DROP TABLE IF EXISTS "users" CASCADE;
    DROP TYPE IF EXISTS "match_status" CASCADE;
    DROP TYPE IF EXISTS "team_status" CASCADE;
    DROP TYPE IF EXISTS "tournament_status" CASCADE;
    DROP TYPE IF EXISTS "tournament_format" CASCADE;
    DROP TYPE IF EXISTS "stage_type" CASCADE;
    DROP TYPE IF EXISTS "role" CASCADE;
  `;
  await client.unsafe(dropSQL);
  console.log('Tables dropped. Creating schema...');

  const createSQL = `
    CREATE TYPE "public"."match_status" AS ENUM('pending', 'in_progress', 'completed', 'walkthrough');
    CREATE TYPE "public"."role" AS ENUM('admin', 'user');
    CREATE TYPE "public"."stage_type" AS ENUM('group', 'winners_bracket', 'losers_bracket', 'grand_final', 'round_robin', 'swiss');
    CREATE TYPE "public"."team_status" AS ENUM('active', 'eliminated', 'withdrawn');
    CREATE TYPE "public"."tournament_format" AS ENUM('single_elim', 'double_elim', 'swiss', 'round_robin');
    CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'ongoing', 'completed', 'cancelled');

    CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "username" varchar(50) NOT NULL,
      "password_hash" varchar NOT NULL,
      "role" "role" DEFAULT 'user' NOT NULL,
      "avatar_url" varchar,
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "users_username_unique" UNIQUE("username")
    );

    CREATE TABLE "tournaments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" varchar(200) NOT NULL,
      "description" text DEFAULT '' NOT NULL,
      "game" varchar(100) NOT NULL,
      "cover_image" varchar,
      "status" "tournament_status" DEFAULT 'draft' NOT NULL,
      "created_by" uuid NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "start_date" timestamp,
      "end_date" timestamp,
      "format" "tournament_format" NOT NULL,
      "team_size" integer DEFAULT 5 NOT NULL,
      "max_teams" integer DEFAULT 16 NOT NULL,
      "bo_count" integer DEFAULT 3 NOT NULL,
      "has_group_stage" boolean DEFAULT false NOT NULL,
      "group_count" integer,
      "advance_per_group" integer,
      "third_place" boolean DEFAULT false NOT NULL,
      "swiss_rounds" integer,
      "format_config" jsonb
    );

    CREATE TABLE "teams" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tournament_id" uuid,
      "name" varchar(100) NOT NULL,
      "seed" integer,
      "logo_url" varchar,
      "logo_emoji" varchar(10),
      "status" "team_status" DEFAULT 'active' NOT NULL
    );

    CREATE TABLE "tournament_teams" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tournament_id" uuid NOT NULL,
      "team_id" uuid NOT NULL,
      "seed" integer,
      "status" "team_status" DEFAULT 'active' NOT NULL,
      "group_label" varchar(20),
      CONSTRAINT "tournament_teams_tournament_id_team_id_unique" UNIQUE("tournament_id", "team_id")
    );

    CREATE TABLE "team_players" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "team_id" uuid NOT NULL,
      "player_name" varchar(50) NOT NULL,
      "player_role" varchar(30),
      "game_id" varchar(50),
      "avatar_emoji" varchar(10),
      "is_captain" boolean DEFAULT false NOT NULL
    );

    CREATE TABLE "stages" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tournament_id" uuid NOT NULL,
      "type" "stage_type" NOT NULL,
      "name" varchar(50) NOT NULL,
      "order" integer NOT NULL
    );

    CREATE TABLE "matches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "stage_id" uuid NOT NULL,
      "group_label" varchar(20),
      "round" integer NOT NULL,
      "position" integer NOT NULL,
      "bracket_pos" integer,
      "team1_id" uuid,
      "team2_id" uuid,
      "winner_id" uuid,
      "loser_id" uuid,
      "team1_score" integer DEFAULT 0 NOT NULL,
      "team2_score" integer DEFAULT 0 NOT NULL,
      "status" "match_status" DEFAULT 'pending' NOT NULL,
      "scheduled_at" timestamp,
      "next_match_id" uuid,
      "next_losers_match_id" uuid,
      "swiss_score_group" integer
    );

    CREATE TABLE "games" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "match_id" uuid NOT NULL,
      "game_number" integer NOT NULL,
      "winner_id" uuid,
      "score" jsonb,
      "duration" integer,
      "map" varchar(100),
      "vod_url" varchar
    );

    CREATE TABLE "standings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tournament_id" uuid NOT NULL,
      "stage_id" uuid NOT NULL,
      "team_id" uuid NOT NULL,
      "group_label" varchar(20),
      "wins" integer DEFAULT 0 NOT NULL,
      "losses" integer DEFAULT 0 NOT NULL,
      "draws" integer DEFAULT 0 NOT NULL,
      "points" integer DEFAULT 0 NOT NULL,
      "game_difference" integer DEFAULT 0 NOT NULL,
      "round_played" integer DEFAULT 0 NOT NULL,
      "rank" integer
    );

    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "team_players" ADD CONSTRAINT "team_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "stages" ADD CONSTRAINT "stages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "matches" ADD CONSTRAINT "matches_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "matches" ADD CONSTRAINT "matches_team1_id_teams_id_fk" FOREIGN KEY ("team1_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "matches" ADD CONSTRAINT "matches_team2_id_teams_id_fk" FOREIGN KEY ("team2_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_teams_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "matches" ADD CONSTRAINT "matches_loser_id_teams_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "games" ADD CONSTRAINT "games_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_teams_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "standings" ADD CONSTRAINT "standings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "standings" ADD CONSTRAINT "standings_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;
    ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
  `;
  await client.unsafe(createSQL);
  console.log('Schema created successfully!');

  // 创建默认 admin 用户（password: admin123）
  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync('admin123', 10);
  await client`INSERT INTO "users" ("username", "password_hash", "role") VALUES ('admin', ${hash}, 'admin')`;
  console.log('Default admin user created (admin / admin123)');

  await client.end();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
