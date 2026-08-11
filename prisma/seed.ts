import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { ROLE_PERMISSIONS, PERMISSIONS, PERMISSION_LABELS } from "../src/lib/auth/permissions";
import { creditWallet, redeemFromWallet } from "../src/lib/ledger";
import { moneyToString } from "../src/lib/money";
import { ensureModulesForClinic } from "../src/lib/modules";
import { ensureSystemTags } from "../src/lib/tags";
import { migrateLegacyTemplates, createTemplate } from "../src/lib/templates";
import { seedPresetAutomations } from "../src/lib/automations";
import { ensureOnboarding } from "../src/lib/onboarding";
import { upsertReferralProgram } from "../src/lib/referrals";
import { ensureDefaultSurvey } from "../src/lib/nps";
import { setModuleEnabled } from "../src/lib/modules";
import { comOrganizacao, semOrganizacao } from "../src/lib/tenant";

function createClient() {
  const url = process.env.DATABASE_URL!;
  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
  });
  return new PrismaClient({ adapter });
}

const prisma = createClient();

/** CPFs válidos fictícios para demonstração */
const DEMO_CPFS = [
  "52998224725",
  "39053344705",
  "15350946056",
  "11144477735",
  "88681579053",
  "23100299000",
  "71528557084",
  "06447510050",
  "91888445068",
  "34719696090",
  "62585174000",
  "80279091004",
  "16987388070",
  "45821623009",
  "57390815041",
  "09456238022",
  "28014769033",
  "69133480066",
  "73601957077",
  "84920568088",
  "01234567890",
  "12345678909",
  "98765432100",
  "11122233396",
  "22233344407",
  "33344455518",
  "44455566629",
  "55566677730",
  "66677788841",
  "77788899952",
  "88899900063",
  "99900011174",
];

function validDemoCpfs() {
  // Filtra apenas CPFs com dígitos verificadores corretos
  return DEMO_CPFS.filter((cpf) => {
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
    let mod = (sum * 10) % 11;
    if (mod === 10) mod = 0;
    if (mod !== Number(cpf[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
    mod = (sum * 10) % 11;
    if (mod === 10) mod = 0;
    return mod === Number(cpf[10]);
  });
}

function generateValidCpf(index: number) {
  const base = String(100000000 + index * 7919).slice(0, 9).split("").map(Number);
  let sum = base.reduce((acc, dig, idx) => acc + dig * (10 - idx), 0);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  const withD1 = [...base, d1];
  sum = withD1.reduce((acc, dig, idx) => acc + dig * (11 - idx), 0);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return [...withD1, d2].join("");
}

async function main() {
  console.log("Seeding Clube de Benefícios Dermaphios...");
  console.log("URLs: http://dermaphios.localhost:3000 | http://admin.localhost:3000");

  // Limpa dados demo (ordem por FKs)
  await prisma.automationActionExecution.deleteMany();
  await prisma.automationExecution.deleteMany();
  await prisma.automationStep.deleteMany();
  await prisma.automationVersion.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.communicationEvent.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.communicationPreference.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.customerTagAssignment.deleteMany();
  await prisma.customerTag.deleteMany();
  await prisma.segmentRule.deleteMany();
  await prisma.dynamicSegment.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.satisfactionSurvey.deleteMany();
  await prisma.recoveryCase.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.referralProgram.deleteMany();
  await prisma.rewardStock.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.voucherRedemption.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.giftCardTransaction.deleteMany();
  await prisma.giftCard.deleteMany();
  await prisma.acceleratorRule.deleteMany();
  await prisma.campaignAttribution.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
  await prisma.apiCredential.deleteMany();
  await prisma.integrationLog.deleteMany();
  await prisma.moduleConfiguration.deleteMany();
  await prisma.featureModule.deleteMany();
  await prisma.onboardingChecklist.deleteMany();
  await prisma.redemptionItem.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.creditLot.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.campaignUse.deleteMany();
  await prisma.campaignProcedure.deleteMany();
  await prisma.campaignUnit.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.card.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.patientOtp.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.category.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.platformAccess.deleteMany();
  await prisma.clinic.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      id: "org_inicial_dermaphios_000",
      slug: "dermaphios",
      name: "Dermaphios",
      tradeName: "Dermaphios",
      document: "12.345.678/0001-90",
      plan: "profissional",
      active: true,
    },
  });

  await prisma.organization.create({
    data: {
      id: "org_plataforma_interno_000",
      slug: "_plataforma",
      name: "Plataforma Fidelize",
      plan: "enterprise",
      active: true,
    },
  });

  const clinic = await prisma.clinic.create({
    data: {
      organizationId: org.id,
      slug: "dermaphios",
      name: "Clínica Dermaphios",
      tradeName: "Dermaphios",
      document: "12.345.678/0001-90",
      email: "contato@dermaphios.com",
      phone: "1133334444",
      timezone: "America/Sao_Paulo",
    },
  });

  const unitCentro = await prisma.unit.create({
    data: {
      organizationId: org.id,
      clinicId: clinic.id,
      name: "Unidade Centro",
      code: "CENTRO",
      address: "Av. Paulista, 1000 - São Paulo/SP",
    },
  });

  const unitJardins = await prisma.unit.create({
    data: {
      organizationId: org.id,
      clinicId: clinic.id,
      name: "Unidade Jardins",
      code: "JARDINS",
      address: "Rua Oscar Freire, 200 - São Paulo/SP",
    },
  });

  for (const [code, name] of Object.entries(PERMISSION_LABELS)) {
    await prisma.permission.create({ data: { code, name } });
  }

  const permissions = await prisma.permission.findMany();
  const permissionByCode = Object.fromEntries(permissions.map((p) => [p.code, p.id]));

  const roleDefs = [
    { code: "ADMIN", name: "Administrador geral" },
    { code: "MANAGER", name: "Gestor da clínica" },
    { code: "RECEPTION", name: "Recepção" },
    { code: "FINANCE", name: "Financeiro" },
  ];

  const roles: Record<string, string> = {};
  for (const role of roleDefs) {
    const created = await prisma.role.create({
      data: {
        organizationId: org.id,
        clinicId: clinic.id,
        code: role.code,
        name: role.name,
        isSystem: true,
        permissions: {
          create: (ROLE_PERMISSIONS[role.code] ?? []).map((code) => ({
            permissionId: permissionByCode[code],
          })),
        },
      },
    });
    roles[role.code] = created.id;
  }

  const passwordHash = await hashPassword("Admin@123");

  const platformRole = await prisma.role.create({
    data: {
      organizationId: null,
      clinicId: null,
      code: "PLATFORM_ADMIN",
      name: "Administrador da plataforma",
      isSystem: true,
    },
  });

  await prisma.user.create({
    data: {
      organizationId: null,
      clinicId: null,
      roleId: platformRole.id,
      name: "Admin Plataforma",
      email: "admin@plataforma.local",
      passwordHash,
      status: "ACTIVE",
    },
  });

  const users = [
    {
      name: "Ana Administradora",
      email: "admin@dermaphios.com",
      roleId: roles.ADMIN,
      unitId: unitCentro.id,
    },
    {
      name: "Marcos Gestor",
      email: "gestor@dermaphios.com",
      roleId: roles.MANAGER,
      unitId: unitCentro.id,
    },
    {
      name: "Rita Recepção",
      email: "recepcao@dermaphios.com",
      roleId: roles.RECEPTION,
      unitId: unitJardins.id,
    },
    {
      name: "Fábio Financeiro",
      email: "financeiro@dermaphios.com",
      roleId: roles.FINANCE,
      unitId: unitCentro.id,
    },
  ];

  const createdUsers = [];
  for (const user of users) {
    createdUsers.push(
      await prisma.user.create({
        data: {
          organizationId: org.id,
          clinicId: clinic.id,
          ...user,
          passwordHash,
          status: "ACTIVE",
        },
      }),
    );
  }

  const categories = await Promise.all(
    [
      {
        name: "Bronze",
        slug: "bronze",
        color: "#B08D57",
        minAnnualSpend: "0",
        minPoints: 0,
        cashbackPercent: "3",
        sortOrder: 1,
        benefits: "Cashback base e acesso ao cartão digital.",
      },
      {
        name: "Prata",
        slug: "prata",
        color: "#A8B0B8",
        minAnnualSpend: "3000",
        minPoints: 3000,
        cashbackPercent: "5",
        sortOrder: 2,
        benefits: "Cashback elevado e prioridade em campanhas.",
      },
      {
        name: "Ouro",
        slug: "ouro",
        color: "#C2A46B",
        minAnnualSpend: "8000",
        minPoints: 8000,
        cashbackPercent: "7",
        sortOrder: 3,
        benefits: "Cashback premium e benefícios exclusivos.",
      },
      {
        name: "Diamante",
        slug: "diamante",
        color: "#7FA3C2",
        minAnnualSpend: "15000",
        minPoints: 15000,
        cashbackPercent: "10",
        sortOrder: 4,
        benefits: "Máximo relacionamento e experiências VIP.",
      },
    ].map((c) =>
      prisma.category.create({
        data: {
          clinicId: clinic.id,
          progressionMode: "SPEND",
          discountPercent: "0",
          active: true,
          ...c,
        },
      }),
    ),
  );

  await prisma.setting.create({
    data: {
      clinicId: clinic.id,
      key: "benefits",
      value: {
        defaultCashbackPercent: 5,
        pointsPerReal: 1,
        releaseDays: 0,
        validityDays: 180,
        maxCashbackPerTransaction: null,
        maxRedemptionPercent: 30,
        maxCashbackPerPatientPeriod: null,
        cashbackPeriodDays: 30,
      },
    },
  });

  const procedures = await Promise.all(
    [
      { code: "LIMPEZA", name: "Limpeza de pele", basePrice: "450", cashbackPercent: "5" },
      { code: "BOTOX", name: "Aplicação de toxina", basePrice: "1800", cashbackPercent: "6" },
      { code: "PREENCH", name: "Preenchimento", basePrice: "2500", cashbackPercent: "7" },
      { code: "LASER", name: "Laser facial", basePrice: "1200", cashbackPercent: "5" },
      { code: "PEELING", name: "Peeling químico", basePrice: "700", cashbackPercent: "4" },
    ].map((p) =>
      prisma.procedure.create({
        data: { clinicId: clinic.id, eligible: true, active: true, ...p },
      }),
    ),
  );

  const firstNames = [
    "Amanda", "Bruna", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela",
    "Helena", "Isabela", "Julia", "Karina", "Larissa", "Marina", "Natália",
    "Olívia", "Patrícia", "Queila", "Renata", "Sofia", "Tatiana", "Úrsula",
    "Valentina", "Wendy", "Yasmin", "Zélia", "Alice", "Beatriz", "Clara",
    "Diana", "Elena", "Flávia", "Giovana",
  ];

  const cpfs = Array.from({ length: 32 }, (_, i) => generateValidCpf(i + 1));
  // Garante unicidade
  if (new Set(cpfs).size !== cpfs.length) {
    throw new Error("CPFs demo duplicados");
  }
  const patients: Array<{
    patient: { id: string };
    wallet: { id: string };
    category: { id: string; minAnnualSpend: unknown; minPoints: number };
  }> = [];

  for (let i = 0; i < 32; i++) {
    const category = categories[Math.min(3, Math.floor(i / 8))];
    const unit = i % 2 === 0 ? unitCentro : unitJardins;
    const patient = await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        unitId: unit.id,
        fullName: `${firstNames[i]} Paciente Demo`,
        cpf: cpfs[i],
        phone: `1199${String(10000000 + i).slice(0, 8)}`,
        email: `paciente${i + 1}@demo.dermaphios.com`,
        birthDate: new Date(1985 + (i % 20), i % 12, (i % 27) + 1),
        regulationConsent: true,
        marketingConsent: i % 3 !== 0,
        externalCode: `EXT-${1000 + i}`,
        status: "ACTIVE",
        consents: {
          create: [
            {
              clinicId: clinic.id,
              type: "regulation",
              accepted: true,
              version: "1.0",
            },
          ],
        },
      },
    });

    const wallet = await prisma.wallet.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        categoryId: category.id,
        annualSpend: moneyToString(category.minAnnualSpend),
        pointsBalance: category.minPoints,
        appointmentCount: 2 + (i % 5),
      },
    });

    patients.push({ patient, wallet, category });
  }

  // Estoque de cartões + vínculo
  for (let i = 0; i < 50; i++) {
    const token = `tok${String(i + 1).padStart(20, "0")}`;
    const card = await prisma.card.create({
      data: {
        clinicId: clinic.id,
        unitId: i % 2 === 0 ? unitCentro.id : unitJardins.id,
        publicToken: token,
        cardNumber: `DERM${String(i + 1).padStart(8, "0")}`,
        status: i < 32 ? "ACTIVE" : "AVAILABLE",
        walletId: i < 32 ? patients[i].wallet.id : null,
        linkedAt: i < 32 ? new Date() : null,
      },
    });
    void card;
  }

  const operatorId = createdUsers[0].id;

  const tablesToBackfill = [
    "Category",
    "Setting",
    "Procedure",
    "Patient",
    "Consent",
    "Wallet",
    "Card",
    "Campaign",
    "NotificationTemplate",
    "Reward",
    "FeatureModule",
    "ModuleConfiguration",
    "OnboardingChecklist",
    "CustomerTag",
    "MessageTemplate",
    "Automation",
    "ReferralProgram",
    "SatisfactionSurvey",
    "LedgerEntry",
    "CreditLot",
    "Redemption",
    "IdempotencyKey",
    "AuditLog",
  ];
  for (const table of tablesToBackfill) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`${table}\` SET organizationId = ? WHERE organizationId IS NULL`,
      org.id,
    );
  }

  // Transações demo sob contexto de tenant (ledger usa prisma estendido)
  await comOrganizacao({ organizationId: org.id }, async () => {
    for (let i = 0; i < 20; i++) {
      const item = patients[i];
      await creditWallet({
        clinicId: clinic.id,
        walletId: item.wallet.id,
        patientId: item.patient.id,
        amount: 100 + i * 25,
        points: 50,
        type: "CREDIT_APPOINTMENT",
        operatorId,
        origin: "seed",
        idempotencyKey: `seed-credit-${i}`,
        expiresAt: new Date(Date.now() + (30 + i) * 24 * 60 * 60 * 1000),
      });
    }

    for (let i = 0; i < 10; i++) {
      const item = patients[i];
      await redeemFromWallet({
        clinicId: clinic.id,
        walletId: item.wallet.id,
        patientId: item.patient.id,
        amount: 40,
        operatorId,
        reason: "Resgate demo",
        idempotencyKey: `seed-redeem-${i}`,
      });
    }

    await creditWallet({
      clinicId: clinic.id,
      walletId: patients[0].wallet.id,
      patientId: patients[0].patient.id,
      amount: 15,
      type: "CREDIT_ADJUSTMENT",
      operatorId,
      origin: "seed-expire",
      idempotencyKey: "seed-credit-expire",
      expiresAt: new Date(Date.now() - 60_000),
    });
  });

  await prisma.campaign.createMany({
    data: [
      {
        organizationId: org.id,
        clinicId: clinic.id,
        name: "Outono Renovação",
        description: "Cashback extra em lasers e peelings.",
        status: "ACTIVE",
        extraCashbackPct: "2",
        extraPoints: 100,
        benefitDescription: "+2% cashback em procedimentos selecionados",
        startsAt: new Date(Date.now() - 7 * 86400000),
        endsAt: new Date(Date.now() + 30 * 86400000),
        couponCode: "OUTONO26",
      },
      {
        organizationId: org.id,
        clinicId: clinic.id,
        name: "Indique e Ganhe",
        description: "Pontos por indicação.",
        status: "ENDED",
        extraCashbackPct: "0",
        extraPoints: 200,
        benefitDescription: "200 pontos por indicação convertida",
        startsAt: new Date(Date.now() - 90 * 86400000),
        endsAt: new Date(Date.now() - 10 * 86400000),
      },
    ],
  });

  await prisma.notificationTemplate.create({
    data: {
      organizationId: org.id,
      clinicId: clinic.id,
      code: "otp_login",
      channel: "whatsapp",
      subject: "Código de acesso",
      body: "Seu código Dermaphios é {{code}}. Válido por 10 minutos.",
    },
  });

  // --- v2 bootstrap ---
  await comOrganizacao({ organizationId: org.id }, async () => {
    await ensureModulesForClinic(clinic.id);
    for (const code of [
      "SEGMENTS",
      "AUTOMATIONS",
      "REFERRAL",
      "NPS",
      "REWARDS",
      "VOUCHERS",
      "GIFT_CARD",
      "ACCELERATORS",
      "BIRTHDAY",
      "WHATSAPP",
      "EMAIL",
    ] as const) {
      await setModuleEnabled({ clinicId: clinic.id, code, enabled: true });
    }
    await ensureSystemTags(clinic.id);
    await ensureOnboarding(clinic.id);
    await migrateLegacyTemplates(clinic.id);
    await createTemplate({
      clinicId: clinic.id,
      data: {
        code: "boas_vindas",
        name: "Boas-vindas",
        channel: "INTERNAL",
        body: "Olá {{nome_paciente}}, bem-vindo(a) ao clube {{nome_clinica}}!",
        language: "pt-BR",
        footerOptOut: true,
      },
    }).catch(() => undefined);
    await seedPresetAutomations(clinic.id);
    await upsertReferralProgram({
      clinicId: clinic.id,
      data: {
        name: "Indique e ganhe",
        referrerCashback: 50,
        referrerPoints: 100,
        referredCashback: 30,
        referredPoints: 50,
        minFirstAppointment: 100,
        conversionDays: 90,
        periodDays: 30,
        benefitValidityDays: 90,
      },
    });
    await ensureDefaultSurvey(clinic.id);
    await prisma.reward.create({
      data: {
        organizationId: org.id,
        clinicId: clinic.id,
        name: "Sessão cortesia de limpeza de pele",
        description: "Resgate com pontos do clube",
        pointsCost: 500,
        stockTotal: 20,
        limitPerPatient: 1,
        status: "ACTIVE",
      },
    });

    // --- v2.1 demo comercial ---
    for (const code of [
      "PUSH",
      "RAFFLES",
      "RECEIPTS",
      "PREDICTIVE",
    ] as const) {
      await setModuleEnabled({ clinicId: clinic.id, code, enabled: true });
    }

    await prisma.widgetOrigin.upsert({
      where: {
        clinicId_origin: {
          clinicId: clinic.id,
          origin: "http://localhost:3000",
        },
      },
      create: {
        organizationId: org.id,
        clinicId: clinic.id,
        origin: "http://localhost:3000",
        active: true,
      },
      update: { active: true },
    });

    const demoPatient = patients[0]?.patient;
    if (demoPatient) {
      await prisma.predictionScore.create({
        data: {
          organizationId: org.id,
          clinicId: clinic.id,
          patientId: demoPatient.id,
          scoreType: "CHURN_RISK",
          score: 78,
          band: "HIGH",
          factors: { reason: "seed" },
        },
      });

      await prisma.raffle.create({
        data: {
          organizationId: org.id,
          clinicId: clinic.id,
          name: "Sorteio de boas-vindas",
          description: "Demo comercial — bilhete com pontos",
          ticketCostPoints: 50,
          maxTicketsPerPatient: 5,
          status: "ACTIVE",
          startsAt: new Date(Date.now() - 7 * 86400000),
          endsAt: new Date(Date.now() + 30 * 86400000),
          prizeDescription: "Voucher R$ 100",
        },
      });
    }
  });

  console.log("Seed concluído.");
  console.log("Login staff: admin@dermaphios.com / Admin@123 (dermaphios.localhost)");
  console.log("Login plataforma: admin@plataforma.local / Admin@123 (admin.localhost)");
  console.log(`Pacientes: ${patients.length} | Categorias: ${categories.length}`);
  console.log(`Procedimentos: ${procedures.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  });
