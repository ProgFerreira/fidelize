import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  absoluteAffiliatePayoutPath,
} from "@/lib/uploads/affiliate-payout-receipt";
import { detectarTipoArquivo, type TipoArquivoDetectado } from "@/lib/uploads/sniff";

const TIPOS = new Set<TipoArquivoDetectado>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { path: segments } = await context.params;
  if (!segments?.length || segments.length > 4) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }
  if (segments.some((s) => s.includes("..") || s.includes("\\") || s.includes("/"))) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const affiliateId = segments[0];
  const ehAfiliado = session.user.roleCode === "AFFILIATE";
  const ehAdminPlataforma = Boolean(session.user.ehAdminPlataforma);
  if (ehAfiliado && session.user.affiliateId !== affiliateId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  if (!ehAfiliado && !ehAdminPlataforma) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const relative = segments.join("/");
  try {
    const absolute = absoluteAffiliatePayoutPath(relative);
    const buf = await readFile(absolute);
    const tipo = detectarTipoArquivo(buf, TIPOS);
    if (!tipo) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}
