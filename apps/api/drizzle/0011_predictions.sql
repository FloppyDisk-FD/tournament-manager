CREATE TABLE IF NOT EXISTS "predictions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "winner_team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "predictions_match_user_unique" UNIQUE("match_id", "user_id")
);--> statement-breakpoint
