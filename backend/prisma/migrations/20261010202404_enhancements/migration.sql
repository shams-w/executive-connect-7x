-- CreateEnum
CREATE TYPE "InboundMode" AS ENUM ('STORE_ONLY', 'ROUTE_TO_CORPORATE_INBOX', 'AUTO_ACKNOWLEDGE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WhatsAppMode" AS ENUM ('MOCK', 'META_TEST', 'META_PRODUCTION');

-- CreateEnum
CREATE TYPE "SendPolicy" AS ENUM ('AUTO', 'REVIEW');

-- AlterEnum
ALTER TYPE "CelebrationStatus" ADD VALUE 'EXPIRED';

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "CelebrationEvent" DROP CONSTRAINT "CelebrationEvent_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "ExcelImport" DROP CONSTRAINT "ExcelImport_uploadedBy_fkey";

-- DropForeignKey
ALTER TABLE "ExcelImportRow" DROP CONSTRAINT "ExcelImportRow_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "ExcelImportRow" DROP CONSTRAINT "ExcelImportRow_importId_fkey";

-- DropForeignKey
ALTER TABLE "InboundMessage" DROP CONSTRAINT "InboundMessage_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "MessageDelivery" DROP CONSTRAINT "MessageDelivery_celebrationEventId_fkey";

-- DropForeignKey
ALTER TABLE "MessageDelivery" DROP CONSTRAINT "MessageDelivery_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshSession" DROP CONSTRAINT "RefreshSession_userId_fkey";

-- AlterTable
ALTER TABLE "CelebrationEvent" ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "bodyText" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImport" ADD CONSTRAINT "ExcelImport_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImportRow" ADD CONSTRAINT "ExcelImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExcelImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcelImportRow" ADD CONSTRAINT "ExcelImportRow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CelebrationEvent" ADD CONSTRAINT "CelebrationEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CelebrationEvent" ADD CONSTRAINT "CelebrationEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_celebrationEventId_fkey" FOREIGN KEY ("celebrationEventId") REFERENCES "CelebrationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preview text for the seeded templates. {{1}}, {{2}} follow Meta's variable order (see "variables").
UPDATE "MessageTemplate" SET "bodyText" = 'Happy birthday, {{1}}! 🎉 Wishing you a wonderful year ahead from all of us.' WHERE "internalName" = 'birthday_greeting_en' AND "bodyText" IS NULL;
UPDATE "MessageTemplate" SET "bodyText" = 'عيد ميلاد سعيد يا {{1}}! 🎉 نتمنى لك عامًا رائعًا مليئًا بالنجاح.' WHERE "internalName" = 'birthday_greeting_ar' AND "bodyText" IS NULL;
UPDATE "MessageTemplate" SET "bodyText" = 'Congratulations, {{1}}, on {{2}} year(s) with us! Thank you for everything you do.' WHERE "internalName" = 'work_anniversary_en' AND "bodyText" IS NULL;
UPDATE "MessageTemplate" SET "bodyText" = 'مبروك يا {{1}} على إتمام {{2}} سنة/سنوات معنا! شكرًا لك على كل ما تقدمه.' WHERE "internalName" = 'work_anniversary_ar' AND "bodyText" IS NULL;
UPDATE "MessageTemplate" SET "bodyText" = 'What a milestone, {{1}}! 🏆 {{2}} year(s) with us. Thank you for your dedication.' WHERE "internalName" = 'work_anniversary_milestone_en' AND "bodyText" IS NULL;
UPDATE "MessageTemplate" SET "bodyText" = 'إنجاز رائع يا {{1}}! 🏆 {{2}} سنة/سنوات معنا. شكرًا لإخلاصك وتفانيك.' WHERE "internalName" = 'work_anniversary_milestone_ar' AND "bodyText" IS NULL;

-- The seeded admin still uses the published demo password; force a change at next sign-in.
UPDATE "User" SET "mustChangePassword" = true WHERE "username" = 'admin';
