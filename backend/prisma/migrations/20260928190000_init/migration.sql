CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN','HR_ADMIN','COMMUNICATIONS_ADMIN','VIEWER');
CREATE TYPE "Language" AS ENUM ('EN','AR');
CREATE TYPE "EventType" AS ENUM ('BIRTHDAY','WORK_ANNIVERSARY','WELCOME','PROMOTION','RETIREMENT','CUSTOM');
CREATE TYPE "CelebrationStatus" AS ENUM ('PENDING_APPROVAL','APPROVED','REJECTED','QUEUED','SENT','CANCELLED');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING','QUEUED','SENT','DELIVERED','READ','FAILED','CANCELLED');
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED','VALIDATED','CONFIRMED','COMPLETED','FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('VALID','WARNING','ERROR','NEW','UPDATE','UNCHANGED','SKIPPED');
CREATE TYPE "InboundProcessingStatus" AS ENUM ('STORED','ROUTED','ACKNOWLEDGED','IGNORED','FAILED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "RefreshSession" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Employee" (
  "id" TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT,
  "fullName" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "email" TEXT,
  "birthday" DATE,
  "joiningDate" DATE NOT NULL,
  "preferredLanguage" "Language" NOT NULL DEFAULT 'EN',
  "department" TEXT,
  "company" TEXT,
  "jobTitle" TEXT,
  "country" TEXT,
  "whatsappConsent" BOOLEAN NOT NULL DEFAULT TRUE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ExcelImport" (
  "id" TEXT PRIMARY KEY,
  "filename" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL REFERENCES "User"("id"),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "newRows" INTEGER NOT NULL DEFAULT 0,
  "updatedRows" INTEGER NOT NULL DEFAULT 0,
  "unchangedRows" INTEGER NOT NULL DEFAULT 0,
  "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "completedAt" TIMESTAMP(3)
);
CREATE TABLE "ExcelImportRow" (
  "id" TEXT PRIMARY KEY,
  "importId" TEXT NOT NULL REFERENCES "ExcelImport"("id") ON DELETE CASCADE,
  "rowNumber" INTEGER NOT NULL,
  "employeeIdValue" TEXT,
  "status" "ImportRowStatus" NOT NULL,
  "errorMessages" JSONB NOT NULL,
  "normalizedData" JSONB NOT NULL,
  "employeeId" TEXT REFERENCES "Employee"("id")
);
CREATE INDEX "ExcelImportRow_importId_idx" ON "ExcelImportRow"("importId");
CREATE TABLE "CelebrationEvent" (
  "id" TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id"),
  "eventType" "EventType" NOT NULL,
  "eventYear" INTEGER NOT NULL,
  "yearsOfService" INTEGER,
  "eventDate" DATE NOT NULL,
  "status" "CelebrationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CelebrationEvent_employeeId_eventType_eventYear_key" UNIQUE ("employeeId","eventType","eventYear")
);
CREATE INDEX "CelebrationEvent_eventDate_status_idx" ON "CelebrationEvent"("eventDate","status");
CREATE TABLE "MessageTemplate" (
  "id" TEXT PRIMARY KEY,
  "internalName" TEXT NOT NULL UNIQUE,
  "metaTemplateName" TEXT NOT NULL,
  "metaTemplateLanguage" TEXT NOT NULL,
  "eventType" "EventType" NOT NULL,
  "language" "Language" NOT NULL,
  "metaCategory" TEXT NOT NULL,
  "variables" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "MessageTemplate_eventType_language_isActive_idx" ON "MessageTemplate"("eventType","language","isActive");
CREATE TABLE "MessageDelivery" (
  "id" TEXT PRIMARY KEY,
  "celebrationEventId" TEXT NOT NULL UNIQUE REFERENCES "CelebrationEvent"("id"),
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id"),
  "metaMessageId" TEXT UNIQUE,
  "templateName" TEXT NOT NULL,
  "recipientPhoneMasked" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "queuedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureReason" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "MessageDelivery_status_nextAttemptAt_idx" ON "MessageDelivery"("status","nextAttemptAt");
CREATE TABLE "InboundMessage" (
  "id" TEXT PRIMARY KEY,
  "waMessageId" TEXT NOT NULL UNIQUE,
  "employeeId" TEXT REFERENCES "Employee"("id"),
  "phone" TEXT NOT NULL,
  "messageType" TEXT NOT NULL,
  "body" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStatus" "InboundProcessingStatus" NOT NULL DEFAULT 'STORED'
);
CREATE TABLE "SystemSetting" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "isSecret" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT REFERENCES "User"("id"),
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
