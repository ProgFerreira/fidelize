-- Agenda de clientes (compromissos agendados, separado do Appointment de fidelidade)
ALTER TABLE `AuditLog` MODIFY `action` ENUM(
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'PATIENT_CREATE',
  'PATIENT_UPDATE',
  'RULE_CHANGE',
  'CATEGORY_CHANGE',
  'CARD_LINK',
  'CARD_BLOCK',
  'CREDIT',
  'REDEMPTION',
  'ADJUSTMENT',
  'REVERSAL',
  'REPORT_EXPORT',
  'PERMISSION_CHANGE',
  'SETTINGS_CHANGE',
  'OTP_REQUEST',
  'MODULE_TOGGLE',
  'TAG_ASSIGN',
  'TAG_REMOVE',
  'SEGMENT_CHANGE',
  'TEMPLATE_CHANGE',
  'COMMUNICATION_SEND',
  'AUTOMATION_RUN',
  'AUTOMATION_CHANGE',
  'REFERRAL_CREATE',
  'REFERRAL_CONVERT',
  'NPS_RESPONSE',
  'REWARD_REDEEM',
  'VOUCHER_ISSUE',
  'VOUCHER_REDEEM',
  'GIFT_CARD',
  'CONSENT_CHANGE',
  'ACCELERATOR_CHANGE',
  'API_KEY_CHANGE',
  'WEBHOOK_DELIVERY',
  'ONBOARDING_STEP',
  'RAFFLE_CHANGE',
  'RECEIPT_REVIEW',
  'PREDICTION_RUN',
  'PUSH_DEVICE',
  'SCHEDULE_CHANGE',
  'OTHER'
) NOT NULL;

CREATE TABLE `ScheduleEvent` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NULL,
    `patientId` VARCHAR(191) NULL,
    `procedureId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` ENUM('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'SCHEDULED',
    `professionalName` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `color` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ScheduleEvent_clinicId_startsAt_idx` ON `ScheduleEvent`(`clinicId`, `startsAt`);
CREATE INDEX `ScheduleEvent_clinicId_status_idx` ON `ScheduleEvent`(`clinicId`, `status`);
CREATE INDEX `ScheduleEvent_clinicId_endsAt_idx` ON `ScheduleEvent`(`clinicId`, `endsAt`);
CREATE INDEX `ScheduleEvent_patientId_startsAt_idx` ON `ScheduleEvent`(`patientId`, `startsAt`);
CREATE INDEX `ScheduleEvent_organizationId_idx` ON `ScheduleEvent`(`organizationId`);

ALTER TABLE `ScheduleEvent`
  ADD CONSTRAINT `ScheduleEvent_clinicId_fkey`
  FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ScheduleEvent`
  ADD CONSTRAINT `ScheduleEvent_unitId_fkey`
  FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ScheduleEvent`
  ADD CONSTRAINT `ScheduleEvent_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ScheduleEvent`
  ADD CONSTRAINT `ScheduleEvent_procedureId_fkey`
  FOREIGN KEY (`procedureId`) REFERENCES `Procedure`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ScheduleEvent`
  ADD CONSTRAINT `ScheduleEvent_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
