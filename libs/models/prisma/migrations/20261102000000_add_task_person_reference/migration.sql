-- AlterTable
ALTER TABLE "task" ADD COLUMN     "contact_id" INTEGER,
ADD COLUMN     "prospect_id" INTEGER;

-- A task references at most one person: a contact or a prospect, never both.
ALTER TABLE "task" ADD CONSTRAINT "task_single_person_reference_check" CHECK ("contact_id" IS NULL OR "prospect_id" IS NULL);

-- CreateIndex
CREATE INDEX "task_contact_id_idx" ON "task"("contact_id");

-- CreateIndex
CREATE INDEX "task_prospect_id_idx" ON "task"("prospect_id");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales"."contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "sales"."prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
