-- AlterTable
ALTER TABLE `AuditLog` MODIFY `action` ENUM('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PATIENT_CREATE', 'PATIENT_UPDATE', 'RULE_CHANGE', 'CATEGORY_CHANGE', 'CARD_LINK', 'CARD_BLOCK', 'CREDIT', 'REDEMPTION', 'ADJUSTMENT', 'REVERSAL', 'REPORT_EXPORT', 'PERMISSION_CHANGE', 'SETTINGS_CHANGE', 'OTP_REQUEST', 'MODULE_TOGGLE', 'TAG_ASSIGN', 'TAG_REMOVE', 'SEGMENT_CHANGE', 'TEMPLATE_CHANGE', 'COMMUNICATION_SEND', 'AUTOMATION_RUN', 'AUTOMATION_CHANGE', 'REFERRAL_CREATE', 'REFERRAL_CONVERT', 'NPS_RESPONSE', 'REWARD_REDEEM', 'VOUCHER_ISSUE', 'VOUCHER_REDEEM', 'GIFT_CARD', 'CONSENT_CHANGE', 'ACCELERATOR_CHANGE', 'API_KEY_CHANGE', 'WEBHOOK_DELIVERY', 'ONBOARDING_STEP', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `LedgerEntry` MODIFY `type` ENUM('CREDIT_APPOINTMENT', 'CREDIT_CAMPAIGN', 'CREDIT_ADJUSTMENT', 'CREDIT_REFERRAL', 'CREDIT_BIRTHDAY', 'CREDIT_AUTOMATION', 'CREDIT_ACCELERATOR', 'DEBIT_REDEMPTION', 'DEBIT_EXPIRATION', 'DEBIT_REWARD', 'DEBIT_VOUCHER', 'GIFT_CARD_ISSUE', 'GIFT_CARD_REDEEM', 'VOUCHER_ISSUE', 'REVERSAL_CREDIT', 'REVERSAL_REDEMPTION', 'ADJUSTMENT') NOT NULL;

-- CreateTable
CREATE TABLE `FeatureModule` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `code` ENUM('CASHBACK', 'POINTS', 'CATEGORIES', 'REFERRAL', 'REWARDS', 'VOUCHERS', 'GIFT_CARD', 'NPS', 'BIRTHDAY', 'AUTOMATIONS', 'WHATSAPP', 'EMAIL', 'SMS', 'PUSH', 'ACCELERATORS', 'RAFFLES', 'RECEIPTS', 'PREDICTIVE', 'TAGS', 'SEGMENTS', 'COMMUNICATIONS', 'CONSENT') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `config` JSON NULL,
    `enabledAt` DATETIME(3) NULL,
    `disabledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeatureModule_clinicId_enabled_idx`(`clinicId`, `enabled`),
    UNIQUE INDEX `FeatureModule_clinicId_code_key`(`clinicId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModuleConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `featureModuleId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ModuleConfiguration_clinicId_idx`(`clinicId`),
    UNIQUE INDEX `ModuleConfiguration_featureModuleId_key_key`(`featureModuleId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OnboardingChecklist` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `step` ENUM('CLINIC_IDENTITY', 'UNITS', 'PATIENT_IMPORT', 'BENEFIT_MODE', 'CATEGORIES', 'VALIDITY_LIMITS', 'COMMUNICATIONS', 'FIRST_CAMPAIGN', 'STAFF_INVITE', 'OPERATION_SIMULATION', 'PUBLISH_CHECKLIST') NOT NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OnboardingChecklist_clinicId_completed_idx`(`clinicId`, `completed`),
    UNIQUE INDEX `OnboardingChecklist_clinicId_step_key`(`clinicId`, `step`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerTag` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#64748b',
    `description` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `autoRules` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerTag_clinicId_active_idx`(`clinicId`, `active`),
    UNIQUE INDEX `CustomerTag_clinicId_slug_key`(`clinicId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerTagAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `source` ENUM('MANUAL', 'AUTOMATIC', 'IMPORT', 'AUTOMATION') NOT NULL DEFAULT 'MANUAL',
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `removedAt` DATETIME(3) NULL,
    `assignedBy` VARCHAR(191) NULL,
    `metadata` JSON NULL,

    INDEX `CustomerTagAssignment_clinicId_patientId_idx`(`clinicId`, `patientId`),
    INDEX `CustomerTagAssignment_clinicId_tagId_idx`(`clinicId`, `tagId`),
    INDEX `CustomerTagAssignment_patientId_removedAt_idx`(`patientId`, `removedAt`),
    UNIQUE INDEX `CustomerTagAssignment_tagId_patientId_key`(`tagId`, `patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DynamicSegment` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `estimatedCount` INTEGER NULL,
    `lastCountedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DynamicSegment_clinicId_active_idx`(`clinicId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SegmentRule` (
    `id` VARCHAR(191) NOT NULL,
    `segmentId` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NOT NULL,
    `operator` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `logicGroup` VARCHAR(191) NOT NULL DEFAULT 'AND',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `SegmentRule_segmentId_idx`(`segmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'EMAIL', 'SMS', 'PUSH', 'INTERNAL') NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `variables` JSON NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'pt-BR',
    `version` INTEGER NOT NULL DEFAULT 1,
    `approvalStatus` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,
    `footerOptOut` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MessageTemplate_clinicId_active_idx`(`clinicId`, `active`),
    INDEX `MessageTemplate_clinicId_approvalStatus_idx`(`clinicId`, `approvalStatus`),
    UNIQUE INDEX `MessageTemplate_clinicId_code_channel_version_key`(`clinicId`, `code`, `channel`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Communication` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NULL,
    `channel` ENUM('WHATSAPP', 'EMAIL', 'SMS', 'PUSH', 'INTERNAL') NOT NULL,
    `templateId` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,
    `automationId` VARCHAR(191) NULL,
    `purpose` ENUM('TRANSACTIONAL', 'SERVICE', 'MARKETING', 'SURVEY', 'REFERRAL') NOT NULL DEFAULT 'SERVICE',
    `status` ENUM('DRAFT', 'SCHEDULED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'CLICKED', 'FAILED', 'CANCELLED', 'BLOCKED_CONSENT') NOT NULL DEFAULT 'DRAFT',
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `toAddress` VARCHAR(191) NULL,
    `providerId` VARCHAR(191) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `clickedAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `errorReason` VARCHAR(191) NULL,
    `optOut` BOOLEAN NOT NULL DEFAULT false,
    `estimatedCost` DECIMAL(19, 4) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Communication_clinicId_status_createdAt_idx`(`clinicId`, `status`, `createdAt`),
    INDEX `Communication_clinicId_channel_createdAt_idx`(`clinicId`, `channel`, `createdAt`),
    INDEX `Communication_patientId_createdAt_idx`(`patientId`, `createdAt`),
    UNIQUE INDEX `Communication_clinicId_idempotencyKey_key`(`clinicId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `communicationId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunicationEvent_communicationId_occurredAt_idx`(`communicationId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationPreference` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'EMAIL', 'SMS', 'PUSH', 'INTERNAL') NOT NULL,
    `purpose` ENUM('TRANSACTIONAL', 'SERVICE', 'MARKETING', 'SURVEY', 'REFERRAL') NOT NULL,
    `allowed` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunicationPreference_clinicId_patientId_idx`(`clinicId`, `patientId`),
    UNIQUE INDEX `CommunicationPreference_patientId_channel_purpose_key`(`patientId`, `channel`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConsentRecord` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'EMAIL', 'SMS', 'PUSH', 'INTERNAL') NULL,
    `purpose` ENUM('TRANSACTIONAL', 'SERVICE', 'MARKETING', 'SURVEY', 'REFERRAL') NOT NULL,
    `origin` VARCHAR(191) NULL,
    `accepted` BOOLEAN NOT NULL,
    `textAccepted` TEXT NULL,
    `version` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsentRecord_clinicId_patientId_purpose_idx`(`clinicId`, `patientId`, `purpose`),
    INDEX `ConsentRecord_patientId_purpose_accepted_idx`(`patientId`, `purpose`, `accepted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Automation` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `trigger` ENUM('PATIENT_REGISTERED', 'FIRST_APPOINTMENT', 'PAYMENT_CONFIRMED', 'CASHBACK_RELEASED', 'POINTS_GRANTED', 'CATEGORY_CHANGED', 'BALANCE_EXPIRING', 'BALANCE_EXPIRED', 'BIRTHDAY', 'PATIENT_INACTIVE', 'NPS_RESPONDED', 'REFERRAL_CREATED', 'REFERRAL_CONVERTED', 'VOUCHER_ISSUED', 'VOUCHER_EXPIRING', 'CAMPAIGN_STARTED', 'SCHEDULED') NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `conditions` JSON NULL,
    `currentVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Automation_clinicId_status_idx`(`clinicId`, `status`),
    INDEX `Automation_clinicId_trigger_idx`(`clinicId`, `trigger`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationVersion` (
    `id` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedBy` VARCHAR(191) NULL,

    UNIQUE INDEX `AutomationVersion_automationId_version_key`(`automationId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationStep` (
    `id` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `actionType` VARCHAR(191) NOT NULL,
    `config` JSON NOT NULL,
    `delayMinutes` INTEGER NOT NULL DEFAULT 0,

    INDEX `AutomationStep_versionId_sortOrder_idx`(`versionId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationExecution` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `automationId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `triggerRef` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RUNNING',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `idempotencyKey` VARCHAR(191) NULL,

    INDEX `AutomationExecution_clinicId_automationId_patientId_idx`(`clinicId`, `automationId`, `patientId`),
    INDEX `AutomationExecution_automationId_startedAt_idx`(`automationId`, `startedAt`),
    UNIQUE INDEX `AutomationExecution_clinicId_idempotencyKey_key`(`clinicId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationActionExecution` (
    `id` VARCHAR(191) NOT NULL,
    `executionId` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `result` JSON NULL,
    `ranAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `idempotencyKey` VARCHAR(191) NULL,

    INDEX `AutomationActionExecution_idempotencyKey_idx`(`idempotencyKey`),
    UNIQUE INDEX `AutomationActionExecution_executionId_stepId_key`(`executionId`, `stepId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReferralProgram` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `referrerCashback` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `referrerPoints` INTEGER NOT NULL DEFAULT 0,
    `referredCashback` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `referredPoints` INTEGER NOT NULL DEFAULT 0,
    `minFirstAppointment` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `conversionDays` INTEGER NOT NULL DEFAULT 90,
    `maxReferralsPerPeriod` INTEGER NULL,
    `periodDays` INTEGER NOT NULL DEFAULT 30,
    `benefitValidityDays` INTEGER NOT NULL DEFAULT 90,
    `unitId` VARCHAR(191) NULL,
    `campaignId` VARCHAR(191) NULL,
    `procedureIds` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReferralProgram_clinicId_active_idx`(`clinicId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Referral` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `referrerId` VARCHAR(191) NOT NULL,
    `referredId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `shortCode` VARCHAR(191) NOT NULL,
    `status` ENUM('LINK_OPENED', 'SIGNUP_STARTED', 'LEAD', 'APPOINTMENT_SCHEDULED', 'CONVERTED', 'BENEFIT_PENDING', 'BENEFIT_GRANTED', 'REJECTED', 'EXPIRED', 'SUSPICIOUS') NOT NULL DEFAULT 'LEAD',
    `leadName` VARCHAR(191) NULL,
    `leadPhone` VARCHAR(191) NULL,
    `leadConsent` BOOLEAN NOT NULL DEFAULT false,
    `openedAt` DATETIME(3) NULL,
    `convertedAt` DATETIME(3) NULL,
    `benefitGrantedAt` DATETIME(3) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `fraudFlags` JSON NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Referral_clinicId_status_idx`(`clinicId`, `status`),
    INDEX `Referral_referrerId_idx`(`referrerId`),
    INDEX `Referral_referredId_idx`(`referredId`),
    UNIQUE INDEX `Referral_clinicId_code_key`(`clinicId`, `code`),
    UNIQUE INDEX `Referral_clinicId_shortCode_key`(`clinicId`, `shortCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SatisfactionSurvey` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `validityDays` INTEGER NOT NULL DEFAULT 7,
    `extraQuestions` JSON NULL,
    `unitId` VARCHAR(191) NULL,
    `procedureId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SatisfactionSurvey_clinicId_active_idx`(`clinicId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyResponse` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `surveyId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `score` INTEGER NOT NULL,
    `classification` ENUM('DETRACTOR', 'PASSIVE', 'PROMOTER') NOT NULL,
    `comment` TEXT NULL,
    `answers` JSON NULL,
    `token` VARCHAR(191) NOT NULL,
    `respondedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `recoveryTaskCreated` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SurveyResponse_token_key`(`token`),
    INDEX `SurveyResponse_clinicId_respondedAt_idx`(`clinicId`, `respondedAt`),
    INDEX `SurveyResponse_patientId_idx`(`patientId`),
    INDEX `SurveyResponse_classification_idx`(`classification`),
    UNIQUE INDEX `SurveyResponse_surveyId_appointmentId_key`(`surveyId`, `appointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecoveryCase` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `status` ENUM('ATTENTION', 'RISK', 'INACTIVE', 'RECOVERED', 'CLOSED') NOT NULL DEFAULT 'ATTENTION',
    `inactiveDays` INTEGER NOT NULL DEFAULT 30,
    `lastContactAt` DATETIME(3) NULL,
    `recoveredAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `ruleConfig` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RecoveryCase_clinicId_status_idx`(`clinicId`, `status`),
    INDEX `RecoveryCase_patientId_status_idx`(`patientId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reward` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `pointsCost` INTEGER NOT NULL,
    `minCategoryId` VARCHAR(191) NULL,
    `stockTotal` INTEGER NULL,
    `stockReserved` INTEGER NOT NULL DEFAULT 0,
    `stockFulfilled` INTEGER NOT NULL DEFAULT 0,
    `limitPerPatient` INTEGER NULL,
    `availableFrom` DATETIME(3) NULL,
    `availableTo` DATETIME(3) NULL,
    `unitIds` JSON NULL,
    `rules` TEXT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Reward_clinicId_status_idx`(`clinicId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardStock` (
    `id` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `delta` INTEGER NOT NULL,
    `reason` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RewardStock_rewardId_createdAt_idx`(`rewardId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `pointsSpent` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('RESERVED', 'PENDING_FULFILLMENT', 'FULFILLED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'RESERVED',
    `reservedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fulfilledAt` DATETIME(3) NULL,
    `fulfilledBy` VARCHAR(191) NULL,
    `unitId` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RewardRedemption_clinicId_status_idx`(`clinicId`, `status`),
    INDEX `RewardRedemption_patientId_idx`(`patientId`),
    INDEX `RewardRedemption_rewardId_idx`(`rewardId`),
    UNIQUE INDEX `RewardRedemption_clinicId_code_key`(`clinicId`, `code`),
    UNIQUE INDEX `RewardRedemption_clinicId_idempotencyKey_key`(`clinicId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voucher` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('FIXED_VALUE', 'PERCENT', 'PROCEDURE', 'GIFT', 'COURTESY', 'FEE', 'RECOVERY', 'BIRTHDAY') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `valueAmount` DECIMAL(19, 4) NULL,
    `valuePercent` DECIMAL(8, 4) NULL,
    `procedureId` VARCHAR(191) NULL,
    `quantity` INTEGER NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `maxUsesPerPatient` INTEGER NOT NULL DEFAULT 1,
    `multiUse` BOOLEAN NOT NULL DEFAULT false,
    `patientId` VARCHAR(191) NULL,
    `unitId` VARCHAR(191) NULL,
    `minAmount` DECIMAL(19, 4) NULL,
    `allowedHours` JSON NULL,
    `combineCashback` BOOLEAN NOT NULL DEFAULT true,
    `combineDiscount` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `startsAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Voucher_clinicId_status_idx`(`clinicId`, `status`),
    INDEX `Voucher_clinicId_expiresAt_idx`(`clinicId`, `expiresAt`),
    UNIQUE INDEX `Voucher_clinicId_code_key`(`clinicId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoucherRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(19, 4) NULL,
    `unitId` VARCHAR(191) NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorId` VARCHAR(191) NULL,
    `metadata` JSON NULL,

    INDEX `VoucherRedemption_voucherId_patientId_idx`(`voucherId`, `patientId`),
    INDEX `VoucherRedemption_clinicId_redeemedAt_idx`(`clinicId`, `redeemedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiftCard` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `buyerPatientId` VARCHAR(191) NULL,
    `beneficiaryPatientId` VARCHAR(191) NULL,
    `buyerName` VARCHAR(191) NULL,
    `beneficiaryName` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `initialAmount` DECIMAL(19, 4) NOT NULL,
    `remainingAmount` DECIMAL(19, 4) NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'ACTIVE', 'PARTIALLY_USED', 'USED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `sendAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `allowPartial` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GiftCard_clinicId_status_idx`(`clinicId`, `status`),
    UNIQUE INDEX `GiftCard_clinicId_code_key`(`clinicId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiftCardTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `giftCardId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(19, 4) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GiftCardTransaction_giftCardId_createdAt_idx`(`giftCardId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcceleratorRule` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `multiplierPoints` DECIMAL(8, 4) NULL,
    `extraCashbackPct` DECIMAL(8, 4) NULL,
    `bonusFixed` DECIMAL(19, 4) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `daysOfWeek` JSON NULL,
    `hours` JSON NULL,
    `procedureIds` JSON NULL,
    `unitIds` JSON NULL,
    `categoryIds` JSON NULL,
    `limitPerPatient` INTEGER NULL,
    `financialCap` DECIMAL(19, 4) NULL,
    `spentAmount` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `stackable` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AcceleratorRule_clinicId_active_startsAt_endsAt_idx`(`clinicId`, `active`, `startsAt`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignAttribution` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `revenue` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `benefitCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `commCost` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT true,
    `attributedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `windowDays` INTEGER NOT NULL DEFAULT 30,

    INDEX `CampaignAttribution_clinicId_campaignId_idx`(`clinicId`, `campaignId`),
    INDEX `CampaignAttribution_patientId_attributedAt_idx`(`patientId`, `attributedAt`),
    INDEX `CampaignAttribution_appointmentId_idx`(`appointmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiCredential` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `keyPrefix` VARCHAR(191) NOT NULL,
    `keyHash` VARCHAR(191) NOT NULL,
    `environment` VARCHAR(191) NOT NULL DEFAULT 'live',
    `scopes` JSON NULL,
    `rateLimitRpm` INTEGER NOT NULL DEFAULT 60,
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApiCredential_clinicId_revokedAt_idx`(`clinicId`, `revokedAt`),
    INDEX `ApiCredential_keyPrefix_idx`(`keyPrefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEndpoint` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `secret` VARCHAR(191) NOT NULL,
    `events` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WebhookEndpoint_clinicId_active_idx`(`clinicId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `endpointId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `nextRetryAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookDelivery_status_nextRetryAt_idx`(`status`, `nextRetryAt`),
    UNIQUE INDEX `WebhookDelivery_endpointId_idempotencyKey_key`(`endpointId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationLog` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NULL,
    `path` VARCHAR(191) NULL,
    `statusCode` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `requestMeta` JSON NULL,
    `responseMeta` JSON NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IntegrationLog_clinicId_createdAt_idx`(`clinicId`, `createdAt`),
    INDEX `IntegrationLog_clinicId_path_idx`(`clinicId`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Patient_clinicId_birthDate_idx` ON `Patient`(`clinicId`, `birthDate`);

-- AddForeignKey
ALTER TABLE `FeatureModule` ADD CONSTRAINT `FeatureModule_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModuleConfiguration` ADD CONSTRAINT `ModuleConfiguration_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ModuleConfiguration` ADD CONSTRAINT `ModuleConfiguration_featureModuleId_fkey` FOREIGN KEY (`featureModuleId`) REFERENCES `FeatureModule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OnboardingChecklist` ADD CONSTRAINT `OnboardingChecklist_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerTag` ADD CONSTRAINT `CustomerTag_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerTagAssignment` ADD CONSTRAINT `CustomerTagAssignment_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `CustomerTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerTagAssignment` ADD CONSTRAINT `CustomerTagAssignment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DynamicSegment` ADD CONSTRAINT `DynamicSegment_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SegmentRule` ADD CONSTRAINT `SegmentRule_segmentId_fkey` FOREIGN KEY (`segmentId`) REFERENCES `DynamicSegment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageTemplate` ADD CONSTRAINT `MessageTemplate_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `MessageTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationEvent` ADD CONSTRAINT `CommunicationEvent_communicationId_fkey` FOREIGN KEY (`communicationId`) REFERENCES `Communication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationPreference` ADD CONSTRAINT `CommunicationPreference_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationPreference` ADD CONSTRAINT `CommunicationPreference_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConsentRecord` ADD CONSTRAINT `ConsentRecord_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Automation` ADD CONSTRAINT `Automation_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationVersion` ADD CONSTRAINT `AutomationVersion_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationStep` ADD CONSTRAINT `AutomationStep_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `AutomationVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationExecution` ADD CONSTRAINT `AutomationExecution_automationId_fkey` FOREIGN KEY (`automationId`) REFERENCES `Automation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationExecution` ADD CONSTRAINT `AutomationExecution_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationActionExecution` ADD CONSTRAINT `AutomationActionExecution_executionId_fkey` FOREIGN KEY (`executionId`) REFERENCES `AutomationExecution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationActionExecution` ADD CONSTRAINT `AutomationActionExecution_stepId_fkey` FOREIGN KEY (`stepId`) REFERENCES `AutomationStep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReferralProgram` ADD CONSTRAINT `ReferralProgram_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `ReferralProgram`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_referredId_fkey` FOREIGN KEY (`referredId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SatisfactionSurvey` ADD CONSTRAINT `SatisfactionSurvey_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `SatisfactionSurvey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyResponse` ADD CONSTRAINT `SurveyResponse_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecoveryCase` ADD CONSTRAINT `RecoveryCase_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecoveryCase` ADD CONSTRAINT `RecoveryCase_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardStock` ADD CONSTRAINT `RewardStock_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `Reward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voucher` ADD CONSTRAINT `Voucher_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherRedemption` ADD CONSTRAINT `VoucherRedemption_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherRedemption` ADD CONSTRAINT `VoucherRedemption_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftCard` ADD CONSTRAINT `GiftCard_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftCard` ADD CONSTRAINT `GiftCard_buyerPatientId_fkey` FOREIGN KEY (`buyerPatientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftCard` ADD CONSTRAINT `GiftCard_beneficiaryPatientId_fkey` FOREIGN KEY (`beneficiaryPatientId`) REFERENCES `Patient`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GiftCardTransaction` ADD CONSTRAINT `GiftCardTransaction_giftCardId_fkey` FOREIGN KEY (`giftCardId`) REFERENCES `GiftCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcceleratorRule` ADD CONSTRAINT `AcceleratorRule_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignAttribution` ADD CONSTRAINT `CampaignAttribution_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignAttribution` ADD CONSTRAINT `CampaignAttribution_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignAttribution` ADD CONSTRAINT `CampaignAttribution_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiCredential` ADD CONSTRAINT `ApiCredential_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookEndpoint` ADD CONSTRAINT `WebhookEndpoint_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookDelivery` ADD CONSTRAINT `WebhookDelivery_endpointId_fkey` FOREIGN KEY (`endpointId`) REFERENCES `WebhookEndpoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationLog` ADD CONSTRAINT `IntegrationLog_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
