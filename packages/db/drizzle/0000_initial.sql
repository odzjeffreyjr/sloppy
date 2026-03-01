CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "firebase_uid" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "display_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "games" (
  "id" text PRIMARY KEY NOT NULL,
  "creator_id" text NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "slug" text NOT NULL UNIQUE,
  "supports_multiplayer" boolean NOT NULL DEFAULT false,
  "version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'draft',
  "play_count" integer NOT NULL DEFAULT 0,
  "storage_path" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "favourites" (
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "game_id" text NOT NULL REFERENCES "games"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "favourites_pkey" PRIMARY KEY ("user_id", "game_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "game_id" text NOT NULL REFERENCES "games"("id"),
  "host_id" text NOT NULL REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'waiting',
  "player_count" integer NOT NULL DEFAULT 0,
  "max_players" integer NOT NULL DEFAULT 4,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "games_slug_idx" ON "games" ("slug");
CREATE INDEX IF NOT EXISTS "games_creator_id_idx" ON "games" ("creator_id");
CREATE INDEX IF NOT EXISTS "games_status_created_at_idx" ON "games" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "favourites_user_id_idx" ON "favourites" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_game_id_status_idx" ON "sessions" ("game_id", "status");
