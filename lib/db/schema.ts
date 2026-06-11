import {
  pgTable,
  pgEnum,
  text,
  uuid,
  boolean,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const GAME_IDS = [
  "imposteri",
  "asocijacije",
  "gradovi-i-sela",
  "guess-the-song",
  "alias",
] as const;
export type GameId = (typeof GAME_IDS)[number];

export const gameIdEnum = pgEnum("game_id", GAME_IDS);
export const roomStatusEnum = pgEnum("room_status", ["lobby", "in_game", "finished"]);
export const gradoviWordStatusEnum = pgEnum("gradovi_word_status", [
  "approved",
  "rejected",
  "pending",
]);
export const gradoviWordSourceEnum = pgEnum("gradovi_word_source", [
  "seed",
  "host",
  "player",
  "ai",
]);
export const gradoviReportStatusEnum = pgEnum("gradovi_report_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  hostPlayerId: uuid("host_player_id"),
  gameId: gameIdEnum("game_id"),
  status: roomStatusEnum("status").notNull().default("lobby"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  // Supabase anon user id; stable across reconnects so a player keeps their seat.
  anonId: uuid("anon_id").notNull(),
  nickname: text("nickname").notNull(),
  isHost: boolean("is_host").notNull().default(false),
  connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
});

// Authoritative per-room game state. Shape of `state` is owned by the game module's TS types.
export const gameStates = pgTable("game_states", {
  roomId: uuid("room_id")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),
  gameId: gameIdEnum("game_id").notNull(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Curated boards for Asocijacije (seed JSON for v1).
export const asocijacijeBoards = pgTable("asocijacije_boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  // 4 columns × (4 hints + 1 column solution) + 1 final solution; shape enforced by the game module.
  board: jsonb("board").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Reusable validation pool for Gradovi i Sela. Host approvals promote unknown answers here.
export const gradoviWords = pgTable(
  "gradovi_words",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: text("category").notNull(),
    canonicalAnswer: text("canonical_answer").notNull(),
    normalizedAnswer: text("normalized_answer").notNull(),
    aliases: jsonb("aliases").notNull().default([]),
    status: gradoviWordStatusEnum("status").notNull().default("pending"),
    source: gradoviWordSourceEnum("source").notNull().default("host"),
    confidence: integer("confidence"),
    notes: text("notes"),
    createdByPlayerId: uuid("created_by_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    reviewedByPlayerId: uuid("reviewed_by_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("gradovi_words_category_normalized_idx").on(
      table.category,
      table.normalizedAnswer,
    ),
  ],
);

// Per-round challenge log. Useful for moderation and for growing the word pool after play.
export const gradoviAnswerReports = pgTable("gradovi_answer_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  category: text("category").notNull(),
  answer: text("answer").notNull(),
  normalizedAnswer: text("normalized_answer").notNull(),
  submittedByPlayerId: uuid("submitted_by_player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  reportedByPlayerId: uuid("reported_by_player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  reason: text("reason"),
  status: gradoviReportStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

// App-wide letter rotation for Gradovi i Sela. One row keeps letters fair across rooms.
export const gradoviLetterRotation = pgTable("gradovi_letter_rotation", {
  key: text("key").primaryKey(),
  queue: jsonb("queue").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Guess-the-Song rounds, captured per session for replay/debug.
export const songRounds = pgTable("song_rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  roundIndex: integer("round_index").notNull(),
  spotifyTrackId: text("spotify_track_id").notNull(),
  previewUrl: text("preview_url"),
  acceptedTitles: jsonb("accepted_titles").notNull(),
  acceptedArtists: jsonb("accepted_artists").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
