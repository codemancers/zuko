-- CreateTable
CREATE TABLE "public"."eve_chat" (
    "session_id" TEXT NOT NULL,
    "title" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "continuation_token" TEXT,
    "stream_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eve_chat_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE INDEX "eve_chat_created_by_id_organization_id_idx" ON "public"."eve_chat"("created_by_id", "organization_id");

-- AddForeignKey
ALTER TABLE "public"."eve_chat" ADD CONSTRAINT "eve_chat_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."eve_chat" ADD CONSTRAINT "eve_chat_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
