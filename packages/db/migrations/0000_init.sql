CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "moddatetime";
--> statement-breakpoint
CREATE TABLE "auth"."api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"reference_id" text NOT NULL,
	"prefix" text,
	"key" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"permissions" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth"."verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"url_patterns" jsonb NOT NULL,
	"tools" jsonb NOT NULL,
	"api" jsonb,
	"api_content_hash" text,
	"min_engine" integer,
	"changelog" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_definition_versions_definition_version" UNIQUE("definition_id","version")
);
--> statement-breakpoint
CREATE TABLE "installs" (
	"user_id" text NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installs_user_id_definition_id_pk" PRIMARY KEY("user_id","definition_id")
);
--> statement-breakpoint
CREATE TABLE "revocations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid,
	"reason" text NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" text
);
--> statement-breakpoint
CREATE TABLE "webmcp_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"page_type" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"contributor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."api_keys" ADD CONSTRAINT "api_keys_reference_id_users_id_fk" FOREIGN KEY ("reference_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_versions" ADD CONSTRAINT "definition_versions_definition_id_webmcp_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."webmcp_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installs" ADD CONSTRAINT "installs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installs" ADD CONSTRAINT "installs_definition_id_webmcp_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."webmcp_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installs" ADD CONSTRAINT "installs_version_id_definition_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."definition_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_definition_id_webmcp_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."webmcp_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_version_id_definition_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."definition_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webmcp_definitions" ADD CONSTRAINT "webmcp_definitions_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_definition_versions_definition_id" ON "definition_versions" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "idx_webmcp_definitions_domain" ON "webmcp_definitions" USING btree ("domain");--> statement-breakpoint
CREATE TRIGGER "mdt_api_keys" BEFORE UPDATE ON "auth"."api_keys" FOR EACH ROW EXECUTE PROCEDURE moddatetime("updated_at");--> statement-breakpoint
CREATE TRIGGER "mdt_accounts" BEFORE UPDATE ON "auth"."accounts" FOR EACH ROW EXECUTE PROCEDURE moddatetime("updated_at");--> statement-breakpoint
CREATE TRIGGER "mdt_sessions" BEFORE UPDATE ON "auth"."sessions" FOR EACH ROW EXECUTE PROCEDURE moddatetime("updated_at");--> statement-breakpoint
CREATE TRIGGER "mdt_users" BEFORE UPDATE ON "auth"."users" FOR EACH ROW EXECUTE PROCEDURE moddatetime("updated_at");--> statement-breakpoint
CREATE TRIGGER "mdt_verifications" BEFORE UPDATE ON "auth"."verifications" FOR EACH ROW EXECUTE PROCEDURE moddatetime("updated_at");--> statement-breakpoint
CREATE TRIGGER "mdt_installs" BEFORE UPDATE ON "installs" FOR EACH ROW EXECUTE PROCEDURE moddatetime("updated_at");--> statement-breakpoint
CREATE TRIGGER "mdt_webmcp_definitions" BEFORE UPDATE ON "webmcp_definitions" FOR EACH ROW EXECUTE PROCEDURE moddatetime("updated_at");