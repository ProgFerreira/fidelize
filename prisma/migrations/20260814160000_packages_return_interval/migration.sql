-- AlterTable
ALTER TABLE `Procedure`
  ADD COLUMN `intervaloRetornoDias` INTEGER NULL,
  ADD COLUMN `packageSessions` INTEGER NULL;

-- CreateTable
CREATE TABLE `TreatmentPackage` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `procedureId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `totalSessions` INTEGER NOT NULL,
    `remainingSessions` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreatmentPackage_clinicId_patientId_status_idx`(`clinicId`, `patientId`, `status`),
    INDEX `TreatmentPackage_clinicId_procedureId_status_idx`(`clinicId`, `procedureId`, `status`),
    INDEX `TreatmentPackage_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreatmentPackageUse` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `scheduleEventId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TreatmentPackageUse_packageId_scheduleEventId_key`(`packageId`, `scheduleEventId`),
    INDEX `TreatmentPackageUse_packageId_createdAt_idx`(`packageId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TreatmentPackage` ADD CONSTRAINT `TreatmentPackage_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPackage` ADD CONSTRAINT `TreatmentPackage_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPackage` ADD CONSTRAINT `TreatmentPackage_procedureId_fkey` FOREIGN KEY (`procedureId`) REFERENCES `Procedure`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPackage` ADD CONSTRAINT `TreatmentPackage_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPackageUse` ADD CONSTRAINT `TreatmentPackageUse_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `TreatmentPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreatmentPackageUse` ADD CONSTRAINT `TreatmentPackageUse_scheduleEventId_fkey` FOREIGN KEY (`scheduleEventId`) REFERENCES `ScheduleEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
