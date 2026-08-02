ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" varchar(50);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
