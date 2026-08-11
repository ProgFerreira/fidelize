-- Itens do atendimento (carrinho / PDV multi-serviço)
CREATE TABLE `AppointmentItem` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NOT NULL,
    `procedureId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `unitPrice` DECIMAL(19, 4) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `lineTotal` DECIMAL(19, 4) NOT NULL,
    `professionalName` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AppointmentItem_appointmentId_idx` ON `AppointmentItem`(`appointmentId`);
CREATE INDEX `AppointmentItem_clinicId_procedureId_idx` ON `AppointmentItem`(`clinicId`, `procedureId`);
CREATE INDEX `AppointmentItem_organizationId_idx` ON `AppointmentItem`(`organizationId`);

ALTER TABLE `AppointmentItem`
  ADD CONSTRAINT `AppointmentItem_appointmentId_fkey`
  FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AppointmentItem`
  ADD CONSTRAINT `AppointmentItem_clinicId_fkey`
  FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AppointmentItem`
  ADD CONSTRAINT `AppointmentItem_procedureId_fkey`
  FOREIGN KEY (`procedureId`) REFERENCES `Procedure`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
