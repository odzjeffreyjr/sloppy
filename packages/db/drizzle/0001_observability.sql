-- Generation Logs (AI cost tracking)
CREATE TABLE IF NOT EXISTS "generation_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "game_id" text REFERENCES "games"("id"),
  "model" text NOT NULL,
  "phase" text NOT NULL,
  "prompt_tokens" integer NOT NULL DEFAULT 0,
  "completion_tokens" integer NOT NULL DEFAULT 0,
  "total_cost" real NOT NULL DEFAULT 0,
  "duration_ms" bigint NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'success',
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "generation_logs_user_id_idx" ON "generation_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "generation_logs_created_at_idx" ON "generation_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "generation_logs_model_idx" ON "generation_logs" ("model");

-- Game Crash Logs
CREATE TABLE IF NOT EXISTS "game_crash_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "game_id" text NOT NULL REFERENCES "games"("id"),
  "user_id" text REFERENCES "users"("id"),
  "error_message" text NOT NULL,
  "stack_trace" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "game_crash_logs_game_id_idx" ON "game_crash_logs" ("game_id");
CREATE INDEX IF NOT EXISTS "game_crash_logs_created_at_idx" ON "game_crash_logs" ("created_at");
