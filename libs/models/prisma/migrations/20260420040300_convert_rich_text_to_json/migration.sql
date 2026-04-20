-- Convert Contact.notes
ALTER TABLE "sales"."contact" ALTER COLUMN "notes" TYPE JSONB USING 
  CASE 
    WHEN "notes" IS NULL OR "notes" = '' THEN NULL
    ELSE jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', "notes"))))
  END;

-- Convert Company.summary
ALTER TABLE "sales"."company" ALTER COLUMN "summary" TYPE JSONB USING 
  CASE 
    WHEN "summary" IS NULL OR "summary" = '' THEN NULL
    ELSE jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', "summary"))))
  END;

-- Convert Deal.summary
ALTER TABLE "sales"."deal" ALTER COLUMN "summary" TYPE JSONB USING 
  CASE 
    WHEN "summary" IS NULL OR "summary" = '' THEN NULL
    ELSE jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', "summary"))))
  END;

-- Convert Task.description
ALTER TABLE "public"."task" ALTER COLUMN "description" TYPE JSONB USING 
  CASE 
    WHEN "description" IS NULL OR "description" = '' THEN NULL
    ELSE jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', "description"))))
  END;
