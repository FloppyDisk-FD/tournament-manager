ALTER TABLE "tournament_teams" ADD COLUMN IF NOT EXISTS "checked_in" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD COLUMN IF NOT EXISTS "checked_in_at" timestamp;
