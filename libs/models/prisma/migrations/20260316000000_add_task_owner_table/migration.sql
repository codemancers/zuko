-- CreateTable
CREATE TABLE "task_owner" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_owner_task_id_user_id_key" ON "task_owner"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "task_owner_user_id_idx" ON "task_owner"("user_id");

-- CreateIndex
CREATE INDEX "task_owner_task_id_idx" ON "task_owner"("task_id");

-- AddForeignKey
ALTER TABLE "task_owner" ADD CONSTRAINT "task_owner_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_owner" ADD CONSTRAINT "task_owner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
