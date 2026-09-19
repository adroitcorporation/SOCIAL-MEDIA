-- Application tables are accessible exclusively via authenticated server services.
-- Deny Data API access if this database is hosted on Supabase.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Block" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Skip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Idea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdeaResonance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Connection" ADD CONSTRAINT "different_students" CHECK ("requesterId" <> "receiverId");
ALTER TABLE "Connection" ADD CONSTRAINT "canonical_pair" CHECK ("pairKey" = LEAST("requesterId", "receiverId") || ':' || GREATEST("requesterId", "receiverId"));
ALTER TABLE "Block" ADD CONSTRAINT "no_self_block" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "Conversation" ADD CONSTRAINT "conversation_shape" CHECK (
  ("type" = 'GROUP' AND "ownerId" IS NOT NULL AND "directKey" IS NULL) OR
  ("type" = 'DIRECT' AND "ownerId" IS NULL AND "directKey" IS NOT NULL AND "ideaId" IS NULL)
);
CREATE UNIQUE INDEX "one_owner_per_conversation" ON "ConversationMember" ("conversationId") WHERE "role" = 'OWNER';

-- Deferred checks allow atomic creation, ownership transfer, and cascading deletion.
CREATE FUNCTION check_conversation_membership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid text; c "Conversation"%ROWTYPE; owner_count integer; member_count integer; actual_owner text;
BEGIN
  IF TG_TABLE_NAME = 'Conversation' THEN
    cid := COALESCE(NEW.id, OLD.id);
  ELSE
    cid := COALESCE(NEW."conversationId", OLD."conversationId");
  END IF;
  SELECT * INTO c FROM "Conversation" WHERE id = cid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*), count(*) FILTER (WHERE role = 'OWNER'), min("userId") FILTER (WHERE role = 'OWNER')
    INTO member_count, owner_count, actual_owner FROM "ConversationMember" WHERE "conversationId" = cid;
  IF c.type = 'GROUP' AND (owner_count <> 1 OR actual_owner <> c."ownerId") THEN
    RAISE EXCEPTION 'A group must have exactly one owner matching ownerId';
  END IF;
  IF c.type = 'DIRECT' AND (member_count <> 2 OR owner_count <> 0) THEN
    RAISE EXCEPTION 'A direct conversation must have two members and no owner';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "conversation_members_integrity" AFTER INSERT OR UPDATE OR DELETE ON "ConversationMember" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_conversation_membership();
CREATE CONSTRAINT TRIGGER "conversation_owner_integrity" AFTER INSERT OR UPDATE ON "Conversation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_conversation_membership();
