import "@/lib/load-env";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import {
  applyMigrationsWithClient,
  diagnoseDb,
  findPrismaCli,
  findTsxCli,
  seedStaffUsers,
} from "@/lib/setup/hostinger-bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function assertSecret(request: Request) {
  const expected = process.env.SETUP_SECRET?.trim();
  if (!expected || expected.length < 16) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "SETUP_SECRET ausente ou curto demais. Adicione no hostinger.env (mín. 16 chars), reinicie o app e tente de novo.",
        },
        { status: 503 },
      ),
    };
  }

  const header = request.headers.get("x-setup-secret")?.trim();
  const query = new URL(request.url).searchParams.get("secret")?.trim();
  if (header !== expected && query !== expected) {
    return { ok: false as const, response: unauthorized() };
  }

  return { ok: true as const, secret: expected };
}

async function runNodeScript(scriptPath: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: { ...process.env },
    timeout: 4 * 60 * 1000,
    maxBuffer: 12 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    stdout: String(stdout || "").slice(-8000),
    stderr: String(stderr || "").slice(-8000),
  };
}

/**
 * Setup one-shot do banco na Hostinger.
 * POST /api/setup/db?secret=SEU_SETUP_SECRET
 * Body JSON opcional: { "migrate": true, "seed": true }
 */
export async function POST(request: Request) {
  const gate = assertSecret(request);
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as {
    seed?: boolean;
    migrate?: boolean;
  };
  const doMigrate = body.migrate !== false;
  const doSeed = body.seed !== false;

  const steps: Array<Record<string, unknown>> = [];

  try {
    if (doMigrate) {
      const prismaCli = findPrismaCli();
      if (prismaCli) {
        try {
          const result = await runNodeScript(prismaCli, ["migrate", "deploy"]);
          steps.push({ step: "migrate", mode: "cli", ok: true, ...result });
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string; message?: string };
          steps.push({
            step: "migrate",
            mode: "cli",
            ok: false,
            stdout: String(err.stdout || "").slice(-8000),
            stderr: String(err.stderr || err.message || "").slice(-8000),
            error: err.message || "migrate failed",
          });
          // Fallback para SQL via Prisma Client
          const fallback = await applyMigrationsWithClient();
          steps.push({ step: "migrate", mode: "client", ...fallback });
          if (!fallback.ok) {
            return NextResponse.json({ ok: false, steps }, { status: 500 });
          }
        }
      } else {
        const fallback = await applyMigrationsWithClient();
        steps.push({ step: "migrate", mode: "client", ...fallback });
        if (!fallback.ok) {
          return NextResponse.json({ ok: false, steps }, { status: 500 });
        }
      }
    }

    if (doSeed) {
      const tsxCli = findTsxCli();
      const seedScript = `${process.cwd()}/prisma/seed.ts`;
      let seededViaCli = false;
      if (tsxCli) {
        try {
          const result = await runNodeScript(tsxCli, [seedScript]);
          steps.push({ step: "seed", mode: "cli", ok: true, ...result });
          seededViaCli = true;
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string; message?: string };
          steps.push({
            step: "seed",
            mode: "cli",
            ok: false,
            stdout: String(err.stdout || "").slice(-8000),
            stderr: String(err.stderr || err.message || "").slice(-8000),
            error: err.message || "seed failed",
          });
        }
      }

      if (!seededViaCli) {
        const result = await seedStaffUsers();
        steps.push({ step: "seed", mode: "client", ...result });
        if (!result.ok) {
          return NextResponse.json({ ok: false, steps }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      steps,
      next: [
        "Abra /login",
        "Organização: dermaphios",
        "E-mail: admin@dermaphios.com",
        "Senha: Admin@123",
        "Depois remova SETUP_SECRET do hostinger.env e reinicie o app.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha no setup",
        steps,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const gate = assertSecret(request);
  if (!gate.ok) return gate.response;

  try {
    const diagnosis = await diagnoseDb();
    return NextResponse.json({
      ok: true,
      usage:
        'POST /api/setup/db?secret=SETUP_SECRET com body opcional {"migrate":true,"seed":true}',
      diagnosis,
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      usage:
        'POST /api/setup/db?secret=SETUP_SECRET com body opcional {"migrate":true,"seed":true}',
      diagnosisError: error instanceof Error ? error.message : String(error),
      prismaCli: findPrismaCli(),
      tsxCli: findTsxCli(),
    });
  }
}
