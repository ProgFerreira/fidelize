-- Cadastro de profissionais + vínculo com agenda
CREATE TABLE `Professional` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `color` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Professional_clinicId_active_idx` ON `Professional`(`clinicId`, `active`);
CREATE INDEX `Professional_clinicId_name_idx` ON `Professional`(`clinicId`, `name`);
CREATE INDEX `Professional_organizationId_idx` ON `Professional`(`organizationId`);

ALTER TABLE `Professional`
  ADD CONSTRAINT `Professional_clinicId_fkey`
  FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Professional`
  ADD CONSTRAINT `Professional_unitId_fkey`
  FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `ProfessionalProcedure` (
    `professionalId` VARCHAR(191) NOT NULL,
    `procedureId` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`professionalId`, `procedureId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ProfessionalProcedure_procedureId_idx` ON `ProfessionalProcedure`(`procedureId`);

ALTER TABLE `ProfessionalProcedure`
  ADD CONSTRAINT `ProfessionalProcedure_professionalId_fkey`
  FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProfessionalProcedure`
  ADD CONSTRAINT `ProfessionalProcedure_procedureId_fkey`
  FOREIGN KEY (`procedureId`) REFERENCES `Procedure`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ScheduleEvent`
  ADD COLUMN `professionalId` VARCHAR(191) NULL;

CREATE INDEX `ScheduleEvent_professionalId_startsAt_idx` ON `ScheduleEvent`(`professionalId`, `startsAt`);

ALTER TABLE `ScheduleEvent`
  ADD CONSTRAINT `ScheduleEvent_professionalId_fkey`
  FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
