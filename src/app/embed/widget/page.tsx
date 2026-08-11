import { headers } from "next/headers";
import {
  extractRequestOrigin,
  frameAncestorsFor,
  getWidgetPatientSnapshotByClinic,
} from "@/lib/widget";
import { prisma } from "@/lib/db";
import { semOrganizacao } from "@/lib/tenant";

export default async function EmbedWidgetPage({
  searchParams,
}: {
  searchParams: Promise<{
    clinic?: string;
    patientId?: string;
    phone?: string;
    /** @deprecated não use API key na URL */
    key?: string;
  }>;
}) {
  const params = await searchParams;
  const h = await headers();
  const origin = extractRequestOrigin({ headers: h });
  const clinicSlug = params.clinic || "";

  const clinic = clinicSlug
    ? await semOrganizacao(() =>
        prisma.clinic.findFirst({
          where: {
            active: true,
            OR: [{ slug: clinicSlug }, { id: clinicSlug }],
          },
          select: { id: true },
        }),
      )
    : null;

  const ancestors = await semOrganizacao(() =>
    frameAncestorsFor(clinic?.id ?? null),
  );

  const snapshot =
    clinicSlug
      ? await getWidgetPatientSnapshotByClinic({
          clinicSlug,
          patientId: params.patientId,
          phone: params.phone,
          origin,
        })
      : null;

  const data =
    snapshot && !("error" in snapshot) ? snapshot : null;
  const blocked =
    snapshot && "error" in snapshot && snapshot.error === "origin_not_allowed";

  return (
    <html lang="pt-BR">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={`frame-ancestors ${ancestors}`}
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "linear-gradient(135deg,#0f172a,#1e3a5f)",
          color: "#f8fafc",
          padding: 16,
        }}
      >
        <div
          style={{
            borderRadius: 12,
            padding: 16,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.08em",
              opacity: 0.7,
            }}
          >
            CLUBE DE BENEFÍCIOS
          </p>
          {blocked ? (
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Origem não autorizada para este widget.
            </p>
          ) : data ? (
            <>
              <p style={{ margin: "8px 0 4px", fontSize: 20, fontWeight: 600 }}>
                Olá, {data.patient.firstName}
              </p>
              <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
                Saldo R$ {Number(data.balance).toFixed(2)} · {data.points} pts
                {data.category ? ` · ${data.category.name}` : ""}
              </p>
            </>
          ) : (
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Informe a clínica e o paciente (slug + patientId) com origem
              allowlistada.
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
