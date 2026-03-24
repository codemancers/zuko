-- CreateTable
CREATE TABLE "sandbox" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sandbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ChatToSandbox" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ChatToSandbox_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "sandbox_name_key" ON "sandbox"("name");

-- CreateIndex
CREATE INDEX "_ChatToSandbox_B_index" ON "_ChatToSandbox"("B");

-- AddForeignKey
ALTER TABLE "_ChatToSandbox" ADD CONSTRAINT "_ChatToSandbox_A_fkey" FOREIGN KEY ("A") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatToSandbox" ADD CONSTRAINT "_ChatToSandbox_B_fkey" FOREIGN KEY ("B") REFERENCES "sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
