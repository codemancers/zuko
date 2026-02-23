-- CreateTable
CREATE TABLE "sales"."activity" (
    "id" SERIAL NOT NULL,
    "activity_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "actor_id" INTEGER,
    "content" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_entity_type_entity_id_created_at_idx" ON "sales"."activity"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_actor_id_idx" ON "sales"."activity"("actor_id");

-- CreateIndex
CREATE INDEX "activity_activity_type_idx" ON "sales"."activity"("activity_type");

-- AddForeignKey
ALTER TABLE "sales"."activity" ADD CONSTRAINT "activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
