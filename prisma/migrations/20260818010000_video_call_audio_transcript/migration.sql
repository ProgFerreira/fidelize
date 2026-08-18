-- CreateTable
CREATE TABLE `VideoCallAudioTranscript` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `durationSeconds` INTEGER NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VideoCallAudioTranscript_clinicId_createdAt_idx`(`clinicId`, `createdAt`),
    INDEX `VideoCallAudioTranscript_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VideoCallAudioTranscript` ADD CONSTRAINT `VideoCallAudioTranscript_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `VideoCallRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallAudioTranscript` ADD CONSTRAINT `VideoCallAudioTranscript_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
