import { NextResponse } from "next/server";
import { CLINICAL_CONNECTORS, clinicalConnectorDocs } from "@/lib/connectors/clinical";

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  return NextResponse.json({
    data: {
      connectors: CLINICAL_CONNECTORS,
      docs: clinicalConnectorDocs(baseUrl),
    },
  });
}
