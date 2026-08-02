ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'tournament_manager';
--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'team_manager';
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
