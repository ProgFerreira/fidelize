-- Catálogo de serviços / tipos de atendimento (produto)
ALTER TABLE `Procedure`
  MODIFY `description` TEXT NULL,
  ADD COLUMN `validityDays` INTEGER NULL,
  ADD COLUMN `durationMinutes` INTEGER NULL DEFAULT 60;

CREATE INDEX `Procedure_clinicId_name_idx` ON `Procedure`(`clinicId`, `name`);
