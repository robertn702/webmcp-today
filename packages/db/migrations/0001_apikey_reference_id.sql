ALTER TABLE "apikey" RENAME COLUMN "user_id" TO "reference_id";--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN "config_id" text DEFAULT 'default' NOT NULL;
