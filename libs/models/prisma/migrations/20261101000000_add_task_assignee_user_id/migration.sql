-- AlterTable
ALTER TABLE "task" ADD COLUMN     "assignee_user_id" INTEGER;

-- CreateIndex
CREATE INDEX "task_assignee_user_id_idx" ON "task"("assignee_user_id");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
