-- Custom SQL migration file, put your code below! --
-- Package-install model: drop per-tool verification/voting, replace with
-- webmcp_definitions / definition_versions / installs. Seed data (configs,
-- tools, verification_snapshots, votes) is dropped; better-auth tables are
-- untouched.

DROP TABLE IF EXISTS "verification_snapshots";
--> statement-breakpoint
DROP TABLE IF EXISTS "votes";
--> statement-breakpoint
DROP TABLE IF EXISTS "tools";
--> statement-breakpoint
DROP TABLE IF EXISTS "configs";
--> statement-breakpoint
CREATE TABLE "webmcp_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"page_type" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"tags" jsonb,
	"min_engine" text,
	"contributor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"url_patterns" jsonb NOT NULL,
	"tools" jsonb NOT NULL,
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
ALTER TABLE "webmcp_definitions" ADD CONSTRAINT "webmcp_definitions_contributor_id_user_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "definition_versions" ADD CONSTRAINT "definition_versions_definition_id_webmcp_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."webmcp_definitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "installs" ADD CONSTRAINT "installs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "installs" ADD CONSTRAINT "installs_definition_id_webmcp_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."webmcp_definitions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "installs" ADD CONSTRAINT "installs_version_id_definition_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."definition_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_webmcp_definitions_domain" ON "webmcp_definitions" USING btree ("domain");
--> statement-breakpoint
CREATE INDEX "idx_definition_versions_definition_id" ON "definition_versions" USING btree ("definition_id");
