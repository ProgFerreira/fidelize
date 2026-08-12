-- CreateTable
CREATE TABLE `AffiliateCommissionPlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `commissionType` ENUM('PERCENT', 'FIXED') NOT NULL DEFAULT 'PERCENT',
    `commissionValue` DECIMAL(19, 4) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `holdDays` INTEGER NOT NULL DEFAULT 14,
    `attributionDays` INTEGER NOT NULL DEFAULT 30,
    `minPayoutAmount` DECIMAL(19, 4) NULL,
    `firstPurchaseOnly` BOOLEAN NOT NULL DEFAULT true,
    `eligiblePlanCodes` JSON NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AffiliateCommissionPlan_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Affiliate` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('AFFILIATE', 'PARTNER') NOT NULL DEFAULT 'AFFILIATE',
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
    `name` VARCHAR(191) NOT NULL,
    `document` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `commissionPlanId` VARCHAR(191) NOT NULL,
    `customCommissionType` ENUM('PERCENT', 'FIXED') NULL,
    `customCommissionValue` DECIMAL(19, 4) NULL,
    `pixKey` VARCHAR(191) NULL,
    `payoutNotes` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `termsAcceptedAt` DATETIME(3) NULL,
    `termsVersion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Affiliate_code_key`(`code`),
    UNIQUE INDEX `Affiliate_userId_key`(`userId`),
    INDEX `Affiliate_status_idx`(`status`),
    INDEX `Affiliate_type_status_idx`(`type`, `status`),
    INDEX `Affiliate_email_idx`(`email`),
    INDEX `Affiliate_document_idx`(`document`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateVisit` (
    `id` VARCHAR(191) NOT NULL,
    `affiliateId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `visitToken` VARCHAR(191) NOT NULL,
    `landingPath` VARCHAR(191) NULL,
    `referer` TEXT NULL,
    `utmSource` VARCHAR(191) NULL,
    `utmMedium` VARCHAR(191) NULL,
    `utmCampaign` VARCHAR(191) NULL,
    `ipHash` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AffiliateVisit_affiliateId_createdAt_idx`(`affiliateId`, `createdAt`),
    INDEX `AffiliateVisit_visitToken_idx`(`visitToken`),
    INDEX `AffiliateVisit_code_createdAt_idx`(`code`, `createdAt`),
    INDEX `AffiliateVisit_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateReferral` (
    `id` VARCHAR(191) NOT NULL,
    `affiliateId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NULL,
    `source` ENUM('COOKIE', 'MANUAL', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `linkedByUserId` VARCHAR(191) NULL,
    `linkReason` TEXT NULL,
    `previousAffiliateId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `activeOrganizationKey` VARCHAR(191) NULL,

    UNIQUE INDEX `AffiliateReferral_activeOrganizationKey_key`(`activeOrganizationKey`),
    INDEX `AffiliateReferral_affiliateId_createdAt_idx`(`affiliateId`, `createdAt`),
    INDEX `AffiliateReferral_organizationId_active_idx`(`organizationId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlatformSale` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `planCode` VARCHAR(191) NOT NULL,
    `grossAmount` DECIMAL(19, 4) NOT NULL,
    `discountAmount` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `netAmount` DECIMAL(19, 4) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmedByUserId` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlatformSale_idempotencyKey_key`(`idempotencyKey`),
    INDEX `PlatformSale_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `PlatformSale_status_confirmedAt_idx`(`status`, `confirmedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateCommission` (
    `id` VARCHAR(191) NOT NULL,
    `affiliateId` VARCHAR(191) NOT NULL,
    `referralId` VARCHAR(191) NULL,
    `platformSaleId` VARCHAR(191) NOT NULL,
    `kind` ENUM('PRIMARY', 'ADJUSTMENT') NOT NULL DEFAULT 'PRIMARY',
    `status` ENUM('PENDING', 'APPROVED', 'AVAILABLE', 'PAID', 'CANCELLED', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
    `baseAmount` DECIMAL(19, 4) NOT NULL,
    `amount` DECIMAL(19, 4) NOT NULL,
    `ruleSnapshot` JSON NOT NULL,
    `availableAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `blockReason` TEXT NULL,
    `fraudFlags` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AffiliateCommission_affiliateId_status_idx`(`affiliateId`, `status`),
    INDEX `AffiliateCommission_status_availableAt_idx`(`status`, `availableAt`),
    INDEX `AffiliateCommission_referralId_idx`(`referralId`),
    UNIQUE INDEX `AffiliateCommission_platformSaleId_kind_key`(`platformSaleId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliatePayout` (
    `id` VARCHAR(191) NOT NULL,
    `affiliateId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `totalAmount` DECIMAL(19, 4) NOT NULL,
    `status` ENUM('DRAFT', 'PROCESSING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `method` VARCHAR(191) NULL,
    `payoutKeyUsed` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `paidByUserId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `receiptPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AffiliatePayout_affiliateId_status_idx`(`affiliateId`, `status`),
    INDEX `AffiliatePayout_status_paidAt_idx`(`status`, `paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliatePayoutItem` (
    `id` VARCHAR(191) NOT NULL,
    `payoutId` VARCHAR(191) NOT NULL,
    `commissionId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(19, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AffiliatePayoutItem_commissionId_idx`(`commissionId`),
    UNIQUE INDEX `AffiliatePayoutItem_payoutId_commissionId_key`(`payoutId`, `commissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AffiliateAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `reason` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AffiliateAuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    INDEX `AffiliateAuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AffiliateAuditLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable AuditAction enum
ALTER TABLE `AuditLog` MODIFY `action` ENUM(
  'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PATIENT_CREATE', 'PATIENT_UPDATE', 'RULE_CHANGE', 'CATEGORY_CHANGE',
  'CARD_LINK', 'CARD_BLOCK', 'CARD_UNBLOCK', 'CARD_REPLACE', 'CARD_STOCK', 'CREDIT', 'REDEMPTION', 'ADJUSTMENT',
  'REVERSAL', 'REPORT_EXPORT', 'PERMISSION_CHANGE', 'SETTINGS_CHANGE', 'OTP_REQUEST', 'MODULE_TOGGLE', 'TAG_ASSIGN',
  'TAG_REMOVE', 'SEGMENT_CHANGE', 'TEMPLATE_CHANGE', 'COMMUNICATION_SEND', 'AUTOMATION_RUN', 'AUTOMATION_CHANGE',
  'REFERRAL_CREATE', 'REFERRAL_CONVERT', 'NPS_RESPONSE', 'REWARD_REDEEM', 'VOUCHER_ISSUE', 'VOUCHER_REDEEM', 'GIFT_CARD',
  'CONSENT_CHANGE', 'ACCELERATOR_CHANGE', 'API_KEY_CHANGE', 'WEBHOOK_DELIVERY', 'ONBOARDING_STEP', 'RAFFLE_CHANGE',
  'RECEIPT_REVIEW', 'PREDICTION_RUN', 'PUSH_DEVICE', 'SCHEDULE_CHANGE',
  'AFFILIATE_APPROVE', 'AFFILIATE_REJECT', 'AFFILIATE_SUSPEND', 'AFFILIATE_BLOCK', 'AFFILIATE_REACTIVATE',
  'AFFILIATE_PLAN_CHANGE', 'AFFILIATE_REFERRAL_LINK', 'AFFILIATE_COMMISSION_BLOCK', 'AFFILIATE_COMMISSION_CANCEL',
  'AFFILIATE_PAYOUT', 'AFFILIATE_PROFILE_CHANGE', 'PLATFORM_SALE_CONFIRM', 'PLATFORM_SALE_CANCEL', 'OTHER'
) NOT NULL;

-- AddForeignKey
ALTER TABLE `Affiliate` ADD CONSTRAINT `Affiliate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Affiliate` ADD CONSTRAINT `Affiliate_commissionPlanId_fkey` FOREIGN KEY (`commissionPlanId`) REFERENCES `AffiliateCommissionPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliateVisit` ADD CONSTRAINT `AffiliateVisit_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `Affiliate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliateReferral` ADD CONSTRAINT `AffiliateReferral_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `Affiliate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliateReferral` ADD CONSTRAINT `AffiliateReferral_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlatformSale` ADD CONSTRAINT `PlatformSale_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliateCommission` ADD CONSTRAINT `AffiliateCommission_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `Affiliate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliateCommission` ADD CONSTRAINT `AffiliateCommission_referralId_fkey` FOREIGN KEY (`referralId`) REFERENCES `AffiliateReferral`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AffiliateCommission` ADD CONSTRAINT `AffiliateCommission_platformSaleId_fkey` FOREIGN KEY (`platformSaleId`) REFERENCES `PlatformSale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliatePayout` ADD CONSTRAINT `AffiliatePayout_affiliateId_fkey` FOREIGN KEY (`affiliateId`) REFERENCES `Affiliate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliatePayoutItem` ADD CONSTRAINT `AffiliatePayoutItem_payoutId_fkey` FOREIGN KEY (`payoutId`) REFERENCES `AffiliatePayout`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AffiliatePayoutItem` ADD CONSTRAINT `AffiliatePayoutItem_commissionId_fkey` FOREIGN KEY (`commissionId`) REFERENCES `AffiliateCommission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
