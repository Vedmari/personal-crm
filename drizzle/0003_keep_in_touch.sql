CREATE TYPE "public"."keep_in_touch_interval" AS ENUM('week', 'month', 'quarter', 'year');--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_every" "keep_in_touch_interval";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "keep_in_touch_since" timestamp with time zone;