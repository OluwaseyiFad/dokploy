CREATE TYPE "public"."avatarType" AS ENUM('predefined', 'uploaded');--> statement-breakpoint
CREATE TABLE "user_avatar" (
	"userId" text PRIMARY KEY NOT NULL,
	"contentType" text NOT NULL,
	"sizeBytes" integer NOT NULL,
	"data" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_temp" ADD COLUMN "avatarType" "avatarType" DEFAULT 'predefined' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_temp" ADD COLUMN "avatarPredefinedId" text;--> statement-breakpoint
ALTER TABLE "user_temp" ADD COLUMN "avatarVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_userId_user_temp_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user_temp"("id") ON DELETE cascade ON UPDATE no action;