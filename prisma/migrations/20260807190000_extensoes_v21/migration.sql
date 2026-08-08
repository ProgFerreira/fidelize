-- Extensões §22: push, OCR, sorteios, preditivo, widget

ALTER TABLE `AuditLog` MODIFY COLUMN `action` ENUM(
  'LOGIN','LOGIN_FAILED','LOGOUT','PATIENT_CREATE','PATIENT_UPDATE','RULE_CHANGE','CATEGORY_CHANGE',
  'CARD_LINK','CARD_BLOCK','CREDIT','REDEMPTION','ADJUSTMENT','REVERSAL','REPORT_EXPORT','PERMISSION_CHANGE',
  'SETTINGS_CHANGE','OTP_REQUEST','MODULE_TOGGLE','TAG_ASSIGN','TAG_REMOVE','SEGMENT_CHANGE','TEMPLATE_CHANGE',
  'COMMUNICATION_SEND','AUTOMATION_RUN','AUTOMATION_CHANGE','REFERRAL_CREATE','REFERRAL_CONVERT','NPS_RESPONSE',
  'REWARD_REDEEM','VOUCHER_ISSUE','VOUCHER_REDEEM','GIFT_CARD','CONSENT_CHANGE','ACCELERATOR_CHANGE',
  'API_KEY_CHANGE','WEBHOOK_DELIVERY','ONBOARDING_STEP','RAFFLE_CHANGE','RECEIPT_REVIEW','PREDICTION_RUN',
  'PUSH_DEVICE','OTHER'
) NOT NULL;

CREATE TABLE `PushDevice` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `appId` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `lastSeenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PushDevice_clinicId_token_key`(`clinicId`, `token`),
  INDEX `PushDevice_patientId_active_idx`(`patientId`, `active`),
  INDEX `PushDevice_clinicId_active_idx`(`clinicId`, `active`),
  INDEX `PushDevice_organizationId_idx`(`organizationId`),
  CONSTRAINT `PushDevice_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PushDevice_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReceiptSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `imageUrl` TEXT NULL,
  `imageHash` VARCHAR(191) NOT NULL,
  `ocrText` TEXT NULL,
  `extractedAmount` DECIMAL(19, 4) NULL,
  `extractedDate` DATETIME(3) NULL,
  `merchantName` VARCHAR(191) NULL,
  `status` ENUM('UPLOADED','PROCESSING','NEEDS_REVIEW','APPROVED','REJECTED','CREDITED') NOT NULL DEFAULT 'UPLOADED',
  `fraudFlags` JSON NULL,
  `fraudScore` INTEGER NOT NULL DEFAULT 0,
  `reviewNotes` TEXT NULL,
  `reviewedBy` VARCHAR(191) NULL,
  `reviewedAt` DATETIME(3) NULL,
  `creditAmount` DECIMAL(19, 4) NULL,
  `ledgerEntryId` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReceiptSubmission_clinicId_idempotencyKey_key`(`clinicId`, `idempotencyKey`),
  INDEX `ReceiptSubmission_clinicId_status_createdAt_idx`(`clinicId`, `status`, `createdAt`),
  INDEX `ReceiptSubmission_patientId_createdAt_idx`(`patientId`, `createdAt`),
  INDEX `ReceiptSubmission_clinicId_imageHash_idx`(`clinicId`, `imageHash`),
  INDEX `ReceiptSubmission_organizationId_idx`(`organizationId`),
  CONSTRAINT `ReceiptSubmission_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ReceiptSubmission_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Raffle` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('DRAFT','ACTIVE','CLOSED','DRAWN','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `ticketCostPoints` INTEGER NOT NULL DEFAULT 50,
  `maxTicketsPerPatient` INTEGER NULL,
  `maxTicketsTotal` INTEGER NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `drawnAt` DATETIME(3) NULL,
  `winnerTicketId` VARCHAR(191) NULL,
  `prizeDescription` VARCHAR(191) NOT NULL,
  `prizeCashback` DECIMAL(19, 4) NULL,
  `prizePoints` INTEGER NULL,
  `ticketCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Raffle_clinicId_status_idx`(`clinicId`, `status`),
  INDEX `Raffle_clinicId_startsAt_endsAt_idx`(`clinicId`, `startsAt`, `endsAt`),
  INDEX `Raffle_organizationId_idx`(`organizationId`),
  CONSTRAINT `Raffle_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RaffleTicket` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NULL,
  `raffleId` VARCHAR(191) NOT NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `ticketNumber` INTEGER NOT NULL,
  `pointsSpent` INTEGER NOT NULL,
  `ledgerEntryId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `RaffleTicket_raffleId_ticketNumber_key`(`raffleId`, `ticketNumber`),
  INDEX `RaffleTicket_clinicId_patientId_idx`(`clinicId`, `patientId`),
  INDEX `RaffleTicket_raffleId_patientId_idx`(`raffleId`, `patientId`),
  INDEX `RaffleTicket_organizationId_idx`(`organizationId`),
  CONSTRAINT `RaffleTicket_raffleId_fkey` FOREIGN KEY (`raffleId`) REFERENCES `Raffle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RaffleTicket_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PredictionScore` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `patientId` VARCHAR(191) NOT NULL,
  `scoreType` VARCHAR(191) NOT NULL,
  `score` DECIMAL(12, 4) NOT NULL,
  `band` VARCHAR(191) NULL,
  `factors` JSON NULL,
  `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PredictionScore_clinicId_patientId_scoreType_key`(`clinicId`, `patientId`, `scoreType`),
  INDEX `PredictionScore_clinicId_scoreType_score_idx`(`clinicId`, `scoreType`, `score`),
  INDEX `PredictionScore_organizationId_idx`(`organizationId`),
  CONSTRAINT `PredictionScore_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PredictionScore_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RevenueForecast` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `periodStart` DATE NOT NULL,
  `periodEnd` DATE NOT NULL,
  `predictedRevenue` DECIMAL(19, 4) NOT NULL,
  `confidence` DECIMAL(8, 4) NULL,
  `method` VARCHAR(191) NOT NULL,
  `breakdown` JSON NULL,
  `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `RevenueForecast_clinicId_periodStart_periodEnd_method_key`(`clinicId`, `periodStart`, `periodEnd`, `method`),
  INDEX `RevenueForecast_clinicId_computedAt_idx`(`clinicId`, `computedAt`),
  INDEX `RevenueForecast_organizationId_idx`(`organizationId`),
  CONSTRAINT `RevenueForecast_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WidgetOrigin` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NULL,
  `clinicId` VARCHAR(191) NOT NULL,
  `origin` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `WidgetOrigin_clinicId_origin_key`(`clinicId`, `origin`),
  INDEX `WidgetOrigin_organizationId_idx`(`organizationId`),
  CONSTRAINT `WidgetOrigin_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
