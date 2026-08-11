-- Commercial readiness: mobile sessions + extensions already tracked in schema
CREATE TABLE IF NOT EXISTS `MobileSession` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `MobileSession_clinicId_tokenHash_key`(`clinicId`, `tokenHash`),
    INDEX `MobileSession_clinicId_patientId_idx`(`clinicId`, `patientId`),
    INDEX `MobileSession_expiresAt_idx`(`expiresAt`),
    INDEX `MobileSession_organizationId_idx`(`organizationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MobileSession`
  ADD CONSTRAINT `MobileSession_clinicId_fkey`
  FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MobileSession`
  ADD CONSTRAINT `MobileSession_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
