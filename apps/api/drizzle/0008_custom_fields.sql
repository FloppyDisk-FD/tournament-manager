ALTER TABLE "tournaments" ADD COLUMN "custom_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;
