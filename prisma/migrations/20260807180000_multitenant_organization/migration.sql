-- Multi-tenant: Organization as SaaS tenant root (Organization → Clinic → Unit)
-- Hand-written to preserve existing data (no drop/recreate).

-- 1. Platform tables
CREATE TABLE IF NOT EXISTS `Organization` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `tradeName` VARCHAR(191) NULL,
  `document` VARCHAR(191) NULL,
  `plan` VARCHAR(191) NOT NULL DEFAULT 'trial',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `suspendedAt` DATETIME(3) NULL,
  `suspensionReason` TEXT NULL,
  `trialEndsAt` DATETIME(3) NULL,
  `maxUsers` INTEGER NULL,
  `maxClinics` INTEGER NULL,
  `maxPatients` INTEGER NULL,
  `contactEmail` VARCHAR(191) NULL,
  `contactPhone` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `Organization_slug_key`(`slug`),
  UNIQUE INDEX `Organization_document_key`(`document`),
  INDEX `Organization_active_idx`(`active`),
  INDEX `Organization_deletedAt_idx`(`deletedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PlatformAccess` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `ip` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endedAt` DATETIME(3) NULL,
  INDEX `PlatformAccess_organizationId_startedAt_idx`(`organizationId`, `startedAt`),
  INDEX `PlatformAccess_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Default org from first clinic (or placeholder)
INSERT INTO `Organization` (
  `id`, `slug`, `name`, `tradeName`, `document`, `plan`, `active`, `createdAt`, `updatedAt`
)
SELECT
  'org_inicial_dermaphios_000',
  'dermaphios',
  COALESCE((SELECT `name` FROM `Clinic` ORDER BY `createdAt` LIMIT 1), 'Dermaphios'),
  (SELECT `tradeName` FROM `Clinic` ORDER BY `createdAt` LIMIT 1),
  (SELECT `document` FROM `Clinic` ORDER BY `createdAt` LIMIT 1),
  'profissional',
  true,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `Organization` WHERE `slug` = 'dermaphios');

INSERT INTO `Organization` (
  `id`, `slug`, `name`, `plan`, `active`, `createdAt`, `updatedAt`
)
SELECT
  'org_plataforma_interno_000',
  '_plataforma',
  'Plataforma Fidelize',
  'enterprise',
  true,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `Organization` WHERE `slug` = '_plataforma');

-- 3. Add columns
ALTER TABLE `Clinic` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Clinic_organizationId_idx` ON `Clinic`(`organizationId`);
ALTER TABLE `Unit` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Unit_organizationId_idx` ON `Unit`(`organizationId`);
ALTER TABLE `Role` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Role_organizationId_idx` ON `Role`(`organizationId`);
ALTER TABLE `User` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `User_organizationId_idx` ON `User`(`organizationId`);
ALTER TABLE `Patient` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Patient_organizationId_idx` ON `Patient`(`organizationId`);
ALTER TABLE `Consent` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Consent_organizationId_idx` ON `Consent`(`organizationId`);
ALTER TABLE `Category` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Category_organizationId_idx` ON `Category`(`organizationId`);
ALTER TABLE `Wallet` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Wallet_organizationId_idx` ON `Wallet`(`organizationId`);
ALTER TABLE `Card` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Card_organizationId_idx` ON `Card`(`organizationId`);
ALTER TABLE `Procedure` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Procedure_organizationId_idx` ON `Procedure`(`organizationId`);
ALTER TABLE `Appointment` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Appointment_organizationId_idx` ON `Appointment`(`organizationId`);
ALTER TABLE `Payment` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Payment_organizationId_idx` ON `Payment`(`organizationId`);
ALTER TABLE `LedgerEntry` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `LedgerEntry_organizationId_idx` ON `LedgerEntry`(`organizationId`);
ALTER TABLE `CreditLot` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `CreditLot_organizationId_idx` ON `CreditLot`(`organizationId`);
ALTER TABLE `Redemption` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Redemption_organizationId_idx` ON `Redemption`(`organizationId`);
ALTER TABLE `Campaign` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Campaign_organizationId_idx` ON `Campaign`(`organizationId`);
ALTER TABLE `Coupon` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Coupon_organizationId_idx` ON `Coupon`(`organizationId`);
ALTER TABLE `Setting` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Setting_organizationId_idx` ON `Setting`(`organizationId`);
ALTER TABLE `IdempotencyKey` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `IdempotencyKey_organizationId_idx` ON `IdempotencyKey`(`organizationId`);
ALTER TABLE `AuditLog` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `AuditLog_organizationId_idx` ON `AuditLog`(`organizationId`);
ALTER TABLE `NotificationTemplate` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `NotificationTemplate_organizationId_idx` ON `NotificationTemplate`(`organizationId`);
ALTER TABLE `PatientOtp` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `PatientOtp_organizationId_idx` ON `PatientOtp`(`organizationId`);
ALTER TABLE `FeatureModule` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `FeatureModule_organizationId_idx` ON `FeatureModule`(`organizationId`);
ALTER TABLE `ModuleConfiguration` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `ModuleConfiguration_organizationId_idx` ON `ModuleConfiguration`(`organizationId`);
ALTER TABLE `OnboardingChecklist` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `OnboardingChecklist_organizationId_idx` ON `OnboardingChecklist`(`organizationId`);
ALTER TABLE `CustomerTag` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `CustomerTag_organizationId_idx` ON `CustomerTag`(`organizationId`);
ALTER TABLE `CustomerTagAssignment` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `CustomerTagAssignment_organizationId_idx` ON `CustomerTagAssignment`(`organizationId`);
ALTER TABLE `DynamicSegment` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `DynamicSegment_organizationId_idx` ON `DynamicSegment`(`organizationId`);
ALTER TABLE `MessageTemplate` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `MessageTemplate_organizationId_idx` ON `MessageTemplate`(`organizationId`);
ALTER TABLE `Communication` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Communication_organizationId_idx` ON `Communication`(`organizationId`);
ALTER TABLE `CommunicationPreference` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `CommunicationPreference_organizationId_idx` ON `CommunicationPreference`(`organizationId`);
ALTER TABLE `ConsentRecord` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `ConsentRecord_organizationId_idx` ON `ConsentRecord`(`organizationId`);
ALTER TABLE `Automation` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Automation_organizationId_idx` ON `Automation`(`organizationId`);
ALTER TABLE `AutomationExecution` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `AutomationExecution_organizationId_idx` ON `AutomationExecution`(`organizationId`);
ALTER TABLE `ReferralProgram` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `ReferralProgram_organizationId_idx` ON `ReferralProgram`(`organizationId`);
ALTER TABLE `Referral` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Referral_organizationId_idx` ON `Referral`(`organizationId`);
ALTER TABLE `SatisfactionSurvey` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `SatisfactionSurvey_organizationId_idx` ON `SatisfactionSurvey`(`organizationId`);
ALTER TABLE `SurveyResponse` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `SurveyResponse_organizationId_idx` ON `SurveyResponse`(`organizationId`);
ALTER TABLE `RecoveryCase` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `RecoveryCase_organizationId_idx` ON `RecoveryCase`(`organizationId`);
ALTER TABLE `Reward` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Reward_organizationId_idx` ON `Reward`(`organizationId`);
ALTER TABLE `RewardRedemption` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `RewardRedemption_organizationId_idx` ON `RewardRedemption`(`organizationId`);
ALTER TABLE `Voucher` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `Voucher_organizationId_idx` ON `Voucher`(`organizationId`);
ALTER TABLE `VoucherRedemption` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `VoucherRedemption_organizationId_idx` ON `VoucherRedemption`(`organizationId`);
ALTER TABLE `GiftCard` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `GiftCard_organizationId_idx` ON `GiftCard`(`organizationId`);
ALTER TABLE `AcceleratorRule` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `AcceleratorRule_organizationId_idx` ON `AcceleratorRule`(`organizationId`);
ALTER TABLE `CampaignAttribution` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `CampaignAttribution_organizationId_idx` ON `CampaignAttribution`(`organizationId`);
ALTER TABLE `ApiCredential` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `ApiCredential_organizationId_idx` ON `ApiCredential`(`organizationId`);
ALTER TABLE `WebhookEndpoint` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `WebhookEndpoint_organizationId_idx` ON `WebhookEndpoint`(`organizationId`);
ALTER TABLE `IntegrationLog` ADD COLUMN `organizationId` VARCHAR(191) NULL;
CREATE INDEX `IntegrationLog_organizationId_idx` ON `IntegrationLog`(`organizationId`);

ALTER TABLE `Clinic` ADD COLUMN `slug` VARCHAR(191) NULL;
ALTER TABLE `Clinic` ADD COLUMN `customDomain` VARCHAR(191) NULL;
CREATE INDEX `Clinic_customDomain_idx` ON `Clinic`(`customDomain`);

-- 4. Backfill
UPDATE `Clinic` SET `organizationId` = 'org_inicial_dermaphios_000', `slug` = 'dermaphios' WHERE `organizationId` IS NULL;

UPDATE `Unit` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Unit` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Role` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Role` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `User` u
  INNER JOIN `Clinic` c ON c.`id` = u.`clinicId`
  SET u.`organizationId` = c.`organizationId`
  WHERE u.`organizationId` IS NULL AND u.`clinicId` IS NOT NULL;
UPDATE `Patient` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Patient` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Consent` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Consent` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Category` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Category` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Wallet` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Wallet` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Card` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Card` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Procedure` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Procedure` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Appointment` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Appointment` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Payment` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Payment` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `LedgerEntry` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `LedgerEntry` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `CreditLot` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `CreditLot` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Redemption` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Redemption` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Campaign` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Campaign` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Coupon` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Coupon` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Setting` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Setting` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `IdempotencyKey` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `IdempotencyKey` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `AuditLog` a
  LEFT JOIN `Clinic` c ON c.`id` = a.`clinicId`
  SET a.`organizationId` = COALESCE(c.`organizationId`, 'org_inicial_dermaphios_000')
  WHERE a.`organizationId` IS NULL;
UPDATE `NotificationTemplate` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `NotificationTemplate` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `PatientOtp` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `PatientOtp` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `FeatureModule` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `FeatureModule` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `ModuleConfiguration` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `ModuleConfiguration` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `OnboardingChecklist` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `OnboardingChecklist` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `CustomerTag` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `CustomerTag` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `CustomerTagAssignment` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `CustomerTagAssignment` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `DynamicSegment` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `DynamicSegment` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `MessageTemplate` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `MessageTemplate` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Communication` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Communication` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `CommunicationPreference` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `CommunicationPreference` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `ConsentRecord` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `ConsentRecord` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Automation` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Automation` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `AutomationExecution` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `AutomationExecution` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `ReferralProgram` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `ReferralProgram` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Referral` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Referral` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `SatisfactionSurvey` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `SatisfactionSurvey` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `SurveyResponse` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `SurveyResponse` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `RecoveryCase` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `RecoveryCase` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Reward` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Reward` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `RewardRedemption` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `RewardRedemption` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `Voucher` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `Voucher` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `VoucherRedemption` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `VoucherRedemption` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `GiftCard` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `GiftCard` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `AcceleratorRule` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `AcceleratorRule` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `CampaignAttribution` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `CampaignAttribution` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `ApiCredential` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `ApiCredential` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `WebhookEndpoint` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `WebhookEndpoint` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;
UPDATE `IntegrationLog` t
  INNER JOIN `Clinic` c ON c.`id` = t.`clinicId`
  SET t.`organizationId` = c.`organizationId`
  WHERE t.`organizationId` IS NULL;
UPDATE `IntegrationLog` SET `organizationId` = 'org_inicial_dermaphios_000' WHERE `organizationId` IS NULL;

-- 5. Clinic unique slug per org
CREATE UNIQUE INDEX `Clinic_organizationId_slug_key` ON `Clinic`(`organizationId`, `slug`);


-- User: clinicId becomes optional workspace context; email unique per organization
ALTER TABLE `User` MODIFY `clinicId` VARCHAR(191) NULL;
DROP INDEX `User_clinicId_email_key` ON `User`;
CREATE UNIQUE INDEX `User_organizationId_email_key` ON `User`(`organizationId`, `email`);
CREATE INDEX `User_organizationId_status_idx` ON `User`(`organizationId`, `status`);

-- 6. Foreign keys
ALTER TABLE `Clinic` ADD CONSTRAINT `Clinic_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `User` ADD CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlatformAccess` ADD CONSTRAINT `PlatformAccess_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlatformAccess` ADD CONSTRAINT `PlatformAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Unit` ADD CONSTRAINT `Unit_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Role` ADD CONSTRAINT `Role_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Patient` ADD CONSTRAINT `Patient_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Consent` ADD CONSTRAINT `Consent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Category` ADD CONSTRAINT `Category_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Wallet` ADD CONSTRAINT `Wallet_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Card` ADD CONSTRAINT `Card_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Procedure` ADD CONSTRAINT `Procedure_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `LedgerEntry` ADD CONSTRAINT `LedgerEntry_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditLot` ADD CONSTRAINT `CreditLot_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Redemption` ADD CONSTRAINT `Redemption_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Setting` ADD CONSTRAINT `Setting_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IdempotencyKey` ADD CONSTRAINT `IdempotencyKey_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `NotificationTemplate` ADD CONSTRAINT `NotificationTemplate_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PatientOtp` ADD CONSTRAINT `PatientOtp_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FeatureModule` ADD CONSTRAINT `FeatureModule_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ModuleConfiguration` ADD CONSTRAINT `ModuleConfiguration_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `OnboardingChecklist` ADD CONSTRAINT `OnboardingChecklist_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerTag` ADD CONSTRAINT `CustomerTag_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerTagAssignment` ADD CONSTRAINT `CustomerTagAssignment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DynamicSegment` ADD CONSTRAINT `DynamicSegment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MessageTemplate` ADD CONSTRAINT `MessageTemplate_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CommunicationPreference` ADD CONSTRAINT `CommunicationPreference_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Automation` ADD CONSTRAINT `Automation_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AutomationExecution` ADD CONSTRAINT `AutomationExecution_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ReferralProgram` ADD CONSTRAINT `ReferralProgram_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SatisfactionSurvey` ADD CONSTRAINT `SatisfactionSurvey_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RecoveryCase` ADD CONSTRAINT `RecoveryCase_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `VoucherRedemption` ADD CONSTRAINT `VoucherRedemption_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `GiftCard` ADD CONSTRAINT `GiftCard_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AcceleratorRule` ADD CONSTRAINT `AcceleratorRule_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CampaignAttribution` ADD CONSTRAINT `CampaignAttribution_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ApiCredential` ADD CONSTRAINT `ApiCredential_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WebhookEndpoint` ADD CONSTRAINT `WebhookEndpoint_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IntegrationLog` ADD CONSTRAINT `IntegrationLog_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento de obrigatoriedade: extensão Prisma fail-closed + FKs.
-- MariaDB 10/11 rejeita CHECK NOT NULL na mesma coluna de FK com ON UPDATE CASCADE.
