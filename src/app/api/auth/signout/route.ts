import { signOut } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("X-Auth-Return-Redirect") === "1";

  if (wantsJson) {
    await signOut({ redirect: false });
    return NextResponse.json({ url: "/login" });
  }

  await signOut({ redirectTo: "/login" });
}
