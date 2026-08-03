ALTER TABLE "tournaments" ADD COLUMN "banner_url" varchar(500);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "sponsors" jsonb DEFAULT '[]'::jsonb NOT NULL;
