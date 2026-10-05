CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'CONNECTIONS_ONLY');
CREATE TABLE "Post" (
  id text PRIMARY KEY, "authorId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "clientId" text NOT NULL, content text NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 10000),
  visibility "PostVisibility" NOT NULL DEFAULT 'PUBLIC', "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX "Post_authorId_clientId_key" ON "Post"("authorId","clientId");
CREATE INDEX "Post_authorId_createdAt_id_idx" ON "Post"("authorId","createdAt" DESC,id DESC);
CREATE INDEX "Post_visibility_createdAt_idx" ON "Post"(visibility,"createdAt" DESC);
CREATE TABLE "PostLike" (
  "postId" text NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY("postId","userId")
);
CREATE INDEX "PostLike_userId_idx" ON "PostLike"("userId");
CREATE TABLE "PostComment" (
  id text PRIMARY KEY, "postId" text NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "clientId" text NOT NULL, content text NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 2000),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PostComment_authorId_clientId_key" ON "PostComment"("authorId","clientId");
CREATE INDEX "PostComment_postId_createdAt_id_idx" ON "PostComment"("postId","createdAt" DESC,id DESC);
ALTER TABLE "Report" ADD COLUMN "postId" text REFERENCES "Post"(id) ON DELETE SET NULL ON UPDATE CASCADE, ADD COLUMN "postContent" text;
CREATE INDEX "Report_postId_idx" ON "Report"("postId");

-- Only the existing trusted Prisma backend accesses these tables, never browser roles.
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostComment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Post", "PostLike", "PostComment" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON "Post", "PostLike", "PostComment" FROM %I', r);
    END IF;
  END LOOP;
END $$;

ALTER TABLE "RecommendationDocument" DROP CONSTRAINT "RecommendationDocument_kind_check";
ALTER TABLE "RecommendationDocument" ADD CONSTRAINT "RecommendationDocument_kind_check" CHECK(kind IN ('PROFILE','IDEA','EVENT','POST'));
ALTER TABLE "RecommendationJob" DROP CONSTRAINT "RecommendationJob_kind_check";
ALTER TABLE "RecommendationJob" ADD CONSTRAINT "RecommendationJob_kind_check" CHECK(kind IN ('PROFILE','IDEA','EVENT','POST'));
CREATE FUNCTION fc_post_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM "RecommendationJob" WHERE kind='POST' AND "targetId"=OLD.id;
    DELETE FROM "RecommendationDocument" WHERE kind='POST' AND "targetId"=OLD.id;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.content IS NOT DISTINCT FROM OLD.content AND NEW.visibility=OLD.visibility THEN RETURN NEW; END IF;
  END IF;
  IF NEW.visibility='PUBLIC' THEN
    INSERT INTO "RecommendationJob"(kind,"targetId") VALUES('POST',NEW.id)
    ON CONFLICT(kind,"targetId") DO UPDATE SET version="RecommendationJob".version+1,attempts=0,"availableAt"=CURRENT_TIMESTAMP,"lockedUntil"=NULL,"lockToken"=NULL,"lastError"=NULL;
  ELSE
    DELETE FROM "RecommendationJob" WHERE kind='POST' AND "targetId"=NEW.id;
  END IF;
  DELETE FROM "RecommendationDocument" WHERE kind='POST' AND "targetId"=NEW.id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION fc_post_changed() FROM PUBLIC;
CREATE TRIGGER fc_post_changed AFTER INSERT OR UPDATE OR DELETE ON "Post" FOR EACH ROW EXECUTE FUNCTION fc_post_changed();
