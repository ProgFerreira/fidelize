import { getWidgetPatientSnapshot } from "@/lib/widget";

export default async function EmbedWidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; patientId?: string; phone?: string }>;
}) {
  const params = await searchParams;
  const key = params.key || "";
  const snapshot =
    key
      ? await getWidgetPatientSnapshot({
          apiKey: key,
          patientId: params.patientId,
          phone: params.phone,
          origin: null,
        })
      : null;

  const data =
    snapshot && !("error" in snapshot) ? snapshot : null;

  return (
    <html lang="pt-BR">
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
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", opacity: 0.7 }}>
            CLUBE DE BENEFÍCIOS
          </p>
          {data ? (
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
              Informe a chave de API e o paciente para exibir o saldo.
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
