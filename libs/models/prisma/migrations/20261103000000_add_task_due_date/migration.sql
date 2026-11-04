-- AlterTable
ALTER TABLE "task" ADD COLUMN     "due_date" DATE;

-- CreateIndex
CREATE INDEX "task_due_date_idx" ON "task"("due_date");
