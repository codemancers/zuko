-- CreateEnum
CREATE TYPE "sales"."TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "sales"."task" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "sales"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "completed_at" TIMESTAMP(3),
    "parent_id" INTEGER,
    "assignee" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_organization_id_idx" ON "sales"."task"("organization_id");

-- CreateIndex
CREATE INDEX "task_parent_id_idx" ON "sales"."task"("parent_id");

-- CreateIndex
CREATE INDEX "task_status_idx" ON "sales"."task"("status");

-- AddForeignKey
ALTER TABLE "sales"."task" ADD CONSTRAINT "task_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sales"."task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
