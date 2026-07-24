-- Custom SQL migration file, put your code below! --
-- minEngine moves from webmcp_definitions (mutable metadata) to
-- definition_versions (append-only): it's a property of a version's content
-- (e.g. a version using the `api` block needs a higher engine level than a
-- DOM-only version), and also changes shape from a semver string to a
-- positive integer capability level.

ALTER TABLE "definition_versions" ADD COLUMN "min_engine" integer;
--> statement-breakpoint
-- Carry over any existing definition-level value onto all of that
-- definition's versions, casting the semver's leading major-version digits
-- to the new integer level (e.g. '1.0.0' -> 1). Rows with no parseable
-- leading digits are left NULL.
UPDATE "definition_versions" AS dv
SET "min_engine" = sub.min_engine_int
FROM (
	SELECT id, (regexp_match(min_engine, '^(\d+)'))[1]::integer AS min_engine_int
	FROM "webmcp_definitions"
	WHERE min_engine ~ '^\d+'
) AS sub
WHERE dv.definition_id = sub.id;
--> statement-breakpoint
ALTER TABLE "webmcp_definitions" DROP COLUMN "min_engine";
