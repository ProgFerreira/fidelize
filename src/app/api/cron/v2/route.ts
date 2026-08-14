import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processCommunicationQueue } from "@/lib/communications";
import {
  processBirthdays,
  processExpiringBalances,
} from "@/lib/automations";
import { classifyInactivePatients } from "@/lib/recovery";
import { processWebhookDeliveries } from "@/lib/integrations";
import { syncAutomaticTags } from "@/lib/tags";
import { computePatientPredictions } from "@/lib/predictive";
import { processAppointmentReminders } from "@/lib/whatsapp/reminders";
import { expireMemberships } from "@/lib/membership";
import { suspendExpiredTrials } from "@/lib/billing/invoices";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { assertCronAuthorized } from "@/lib/security/secrets";

export async function POST(request: Request) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clinics = await semOrganizacao(() =>
    prisma.clinic.findMany({
      where: { active: true },
      select: { id: true, organizationId: true },
    }),
  );

  const summary = {
    communications: 0,
    birthdays: 0,
    expiring: 0,
    recovery: 0,
    webhooks: 0,
    tags: 0,
    predictive: 0,
    reminders: 0,
    membershipsExpired: 0,
    trialsSuspended: 0,
  };

  for (const clinic of clinics) {
    if (!clinic.organizationId) continue;
    await comOrganizacao({ organizationId: clinic.organizationId }, async () => {
      summary.communications += (
        await processCommunicationQueue(clinic.id)
      ).length;
      summary.birthdays += (await processBirthdays(clinic.id)).length;
      summary.expiring += (await processExpiringBalances(clinic.id)).length;
      try {
        summary.reminders += await processAppointmentReminders(clinic.id);
      } catch {
        // whatsapp/communications may be off
      }
      try {
        summary.recovery += (await classifyInactivePatients(clinic.id)).length;
      } catch {
        // tags module may be off
      }
      try {
        const tags = await syncAutomaticTags(clinic.id);
        summary.tags += tags.changed;
      } catch {
        // tags module may be off
      }
      try {
        const pred = await computePatientPredictions(clinic.id);
        summary.predictive += pred.scores;
      } catch {
        // predictive module may be off
      }
      summary.webhooks += (await processWebhookDeliveries()).length;
      try {
        summary.membershipsExpired += (
          await expireMemberships(clinic.id)
        ).count;
      } catch {
        // membership tables may still be migrating
      }
    });
  }

  try {
    summary.trialsSuspended += (await suspendExpiredTrials()).count;
  } catch {
    // billing optional
  }

  return NextResponse.json({ ok: true, summary });
}
