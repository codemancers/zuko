-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('none', 'admin', 'accountant');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'none';
