-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "role" "ChatMessageRole" NOT NULL,
    "parts" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_message_chat_id_created_at_idx" ON "chat_message"("chat_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
