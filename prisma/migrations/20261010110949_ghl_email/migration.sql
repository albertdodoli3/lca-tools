-- AlterTable
ALTER TABLE "public"."EmailLog" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'smtp';

-- AlterTable
ALTER TABLE "public"."Settings" ADD COLUMN     "emailMode" TEXT NOT NULL DEFAULT 'smtp',
ADD COLUMN     "ghlEmailFrom" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ghlLocationId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ghlTokenEnc" TEXT NOT NULL DEFAULT '';
