ALTER TABLE `Patient`
  ADD COLUMN `holderPatientId` VARCHAR(191) NULL,
  ADD COLUMN `bookingBlockedUntil` DATETIME(3) NULL,
  ADD COLUMN `noShowCount` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `Patient_holderPatientId_idx` ON `Patient`(`holderPatientId`);

ALTER TABLE `Patient` ADD CONSTRAINT `Patient_holderPatientId_fkey` FOREIGN KEY (`holderPatientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Procedure`
  ADD COLUMN `stockQty` INTEGER NULL,
  ADD COLUMN `stockAlertAt` INTEGER NULL;

ALTER TABLE `Professional`
  ADD COLUMN `commissionPercent` DECIMAL(8, 4) NULL;

ALTER TABLE `ScheduleEvent`
  ADD COLUMN `depositAmount` DECIMAL(19, 4) NULL,
  ADD COLUMN `depositMethod` VARCHAR(191) NULL,
  ADD COLUMN `depositStatus` VARCHAR(191) NULL,
  ADD COLUMN `depositLedgerId` VARCHAR(191) NULL;

CREATE TABLE `OrganizationInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `planCode` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(19, 4) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganizationInvoice_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `OrganizationInvoice_status_periodEnd_idx`(`status`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrganizationInvoice` ADD CONSTRAINT `OrganizationInvoice_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `MembershipPlan` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `monthlyPrice` DECIMAL(19, 4) NOT NULL,
    `extraCashbackPct` DECIMAL(8, 4) NOT NULL DEFAULT 0,
    `courtesyNote` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MembershipPlan_clinicId_active_idx`(`clinicId`, `active`),
    INDEX `MembershipPlan_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MembershipPlan` ADD CONSTRAINT `MembershipPlan_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `PatientMembership` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `renewsAt` DATETIME(3) NOT NULL,
    `paidMethod` VARCHAR(191) NULL,
    `paidAmount` DECIMAL(19, 4) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PatientMembership_clinicId_status_idx`(`clinicId`, `status`),
    INDEX `PatientMembership_patientId_status_idx`(`patientId`, `status`),
    INDEX `PatientMembership_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PatientMembership` ADD CONSTRAINT `PatientMembership_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PatientMembership` ADD CONSTRAINT `PatientMembership_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PatientMembership` ADD CONSTRAINT `PatientMembership_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `MembershipPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
