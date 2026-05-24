CREATE TABLE "gradovi_letter_rotation" (
	"key" text PRIMARY KEY NOT NULL,
	"queue" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
