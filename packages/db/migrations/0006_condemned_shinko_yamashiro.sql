CREATE TABLE "revocations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid,
	"reason" text NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" text
);
--> statement-breakpoint
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_definition_id_webmcp_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."webmcp_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_version_id_definition_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."definition_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;