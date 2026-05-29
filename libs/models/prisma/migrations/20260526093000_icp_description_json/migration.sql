-- AlterTable: change description from text to jsonb
ALTER TABLE "sales"."icp_profile" ALTER COLUMN "description" TYPE JSONB USING CASE WHEN "description" IS NULL THEN NULL ELSE jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', "description")))) END;
