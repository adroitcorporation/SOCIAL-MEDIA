-- Keep lock order consistent with the worker: job first, document second.
-- Changing only college/location/year does not change the provider input.
CREATE OR REPLACE FUNCTION fc_enqueue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text; payload jsonb; old_payload jsonb;
BEGIN
 k := CASE TG_TABLE_NAME WHEN 'User' THEN 'PROFILE' WHEN 'Idea' THEN 'IDEA' ELSE 'EVENT' END;
 IF TG_OP='DELETE' THEN
   DELETE FROM "RecommendationJob" WHERE kind=k AND "targetId"=OLD.id;
   DELETE FROM "RecommendationDocument" WHERE kind=k AND "targetId"=OLD.id;
   DELETE FROM "RecommendationInteraction" WHERE "targetType"=k AND "targetId"=OLD.id;
   RETURN OLD;
 END IF;
 IF k='PROFILE' THEN
   payload:=jsonb_build_array(NEW.bio,NEW.skills,NEW.interests,NEW.domains,NEW."lookingFor");
   IF TG_OP='UPDATE' THEN old_payload:=jsonb_build_array(OLD.bio,OLD.skills,OLD.interests,OLD.domains,OLD."lookingFor"); END IF;
 ELSIF k='IDEA' THEN
   payload:=jsonb_build_array(NEW.title,NEW.description,NEW.category,NEW.skills,NEW.tags);
   IF TG_OP='UPDATE' THEN old_payload:=jsonb_build_array(OLD.title,OLD.description,OLD.category,OLD.skills,OLD.tags); END IF;
 ELSE
   payload:=jsonb_build_array(NEW.title,NEW.description,NEW.category);
   IF TG_OP='UPDATE' THEN old_payload:=jsonb_build_array(OLD.title,OLD.description,OLD.category); END IF;
 END IF;
 IF payload IS NOT DISTINCT FROM old_payload THEN RETURN NEW; END IF;
 INSERT INTO "RecommendationJob"(kind,"targetId") VALUES(k,NEW.id)
 ON CONFLICT(kind,"targetId") DO UPDATE SET version="RecommendationJob".version+1, attempts=0,"availableAt"=CURRENT_TIMESTAMP,"lockedUntil"=NULL,"lockToken"=NULL,"lastError"=NULL;
 DELETE FROM "RecommendationDocument" WHERE kind=k AND "targetId"=NEW.id;
 RETURN NEW;
END $$;
-- Unknown names in non-Latin scripts must not collapse to the same empty key.
CREATE OR REPLACE FUNCTION fc_key(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT COALESCE(NULLIF(regexp_replace(lower(trim(value)), '[^a-z0-9]+', '', 'g'),''),lower(trim(value)))
$$;
