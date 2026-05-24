CREATE TYPE "public"."gradovi_report_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."gradovi_word_source" AS ENUM('seed', 'host', 'player', 'ai');--> statement-breakpoint
CREATE TYPE "public"."gradovi_word_status" AS ENUM('approved', 'rejected', 'pending');--> statement-breakpoint
CREATE TABLE "gradovi_answer_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"category" text NOT NULL,
	"answer" text NOT NULL,
	"normalized_answer" text NOT NULL,
	"submitted_by_player_id" uuid,
	"reported_by_player_id" uuid,
	"reason" text,
	"status" "gradovi_report_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gradovi_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"canonical_answer" text NOT NULL,
	"normalized_answer" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "gradovi_word_status" DEFAULT 'pending' NOT NULL,
	"source" "gradovi_word_source" DEFAULT 'host' NOT NULL,
	"confidence" integer,
	"notes" text,
	"created_by_player_id" uuid,
	"reviewed_by_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "gradovi_answer_reports" ADD CONSTRAINT "gradovi_answer_reports_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradovi_answer_reports" ADD CONSTRAINT "gradovi_answer_reports_submitted_by_player_id_players_id_fk" FOREIGN KEY ("submitted_by_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradovi_answer_reports" ADD CONSTRAINT "gradovi_answer_reports_reported_by_player_id_players_id_fk" FOREIGN KEY ("reported_by_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradovi_words" ADD CONSTRAINT "gradovi_words_created_by_player_id_players_id_fk" FOREIGN KEY ("created_by_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gradovi_words" ADD CONSTRAINT "gradovi_words_reviewed_by_player_id_players_id_fk" FOREIGN KEY ("reviewed_by_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gradovi_words_category_normalized_idx" ON "gradovi_words" USING btree ("category","normalized_answer");