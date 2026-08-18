-- CreateTable
CREATE TABLE `VideoCallChatTranscript` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `messageCount` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VideoCallChatTranscript_clinicId_createdAt_idx`(`clinicId`, `createdAt`),
    INDEX `VideoCallChatTranscript_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VideoCallChatTranscript` ADD CONSTRAINT `VideoCallChatTranscript_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `VideoCallRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoCallChatTranscript` ADD CONSTRAINT `VideoCallChatTranscript_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
