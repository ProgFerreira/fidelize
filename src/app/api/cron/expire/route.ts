import { NextResponse } from "next/server";
import { releasePendingLots, expireLots } from "@/lib/ledger";
import { prisma } from "@/lib/db";
import { comOrganizacao, semOrganizacao } from "@/lib/tenant";
import { assertCronAuthorized } from "@/lib/security/secrets";

export async function POST(request: Request) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await semOrganizacao(() =>
    prisma.organization.findMany({
      where: { active: true, deletedAt: null, slug: { not: "_plataforma" } },
      select: { id: true, slug: true },
    }),
  );

  const results = [];
  for (const org of orgs) {
    const result = await comOrganizacao({ organizationId: org.id }, async () => {
      const released = await releasePendingLots();
      const expired = await expireLots();
      return { organizationId: org.id, slug: org.slug, released, expired };
    });
    results.push(result);
  }

  return NextResponse.json({
    ok: true,
    results,
    at: new Date().toISOString(),
  });
}
