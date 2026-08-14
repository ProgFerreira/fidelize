-- AlterTable
ALTER TABLE `FeatureModule` MODIFY `code` ENUM('CASHBACK', 'POINTS', 'CATEGORIES', 'REFERRAL', 'REWARDS', 'VOUCHERS', 'GIFT_CARD', 'NPS', 'BIRTHDAY', 'AUTOMATIONS', 'WHATSAPP', 'EMAIL', 'SMS', 'PUSH', 'ACCELERATORS', 'RAFFLES', 'RECEIPTS', 'PREDICTIVE', 'TAGS', 'SEGMENTS', 'COMMUNICATIONS', 'CONSENT', 'VIDEOCALLS') NOT NULL;

-- CreateTable
CREATE TABLE `VideoCallRoom` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `scheduleEventId` VARCHAR(191) NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `status` ENUM('CRIADA', 'AGUARDANDO', 'EM_ANDAMENTO', 'ENCERRADA', 'CANCELADA') NOT NULL DEFAULT 'CRIADA',
    `patientConsentAt` DATETIME(3) NULL,
    `staffConsentAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VideoCallRoom_scheduleEventId_key`(`scheduleEventId`),
    INDEX `VideoCallRoom_clinicId_status_idx`(`clinicId`, `status`),
    INDEX `VideoCallRoom_patientId_idx`(`patientId`),
    INDEX `VideoCallRoom_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VideoCallSignal` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `fromRole` ENUM('PROFISSIONAL', 'PACIENTE') NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VideoCallSignal_roomId_createdAt_idx`(`roomId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VideoCallRecording` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DISPONIVEL',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VideoCallRecording_clinicId_createdAt_idx`(`clinicId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VideoCallRoom` ADD CONSTRAINT `VideoCallRoom_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallRoom` ADD CONSTRAINT `VideoCallRoom_scheduleEventId_fkey` FOREIGN KEY (`scheduleEventId`) REFERENCES `ScheduleEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallRoom` ADD CONSTRAINT `VideoCallRoom_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallRoom` ADD CONSTRAINT `VideoCallRoom_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallSignal` ADD CONSTRAINT `VideoCallSignal_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `VideoCallRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallRecording` ADD CONSTRAINT `VideoCallRecording_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `VideoCallRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallRecording` ADD CONSTRAINT `VideoCallRecording_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
