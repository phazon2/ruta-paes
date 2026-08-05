// Endpoint de salud/diagnostico interno (GET, sin datos de usuario).
// Permite al agente verificar en produccion: env vars presentes, Gemini vivo,
// pipeline completo (diagnostico + QA + oplog) con un input canned.
//   /api/health           -> chequeo liviano
//   /api/health?full=1    -> corre el pipeline completo y reporta tiempos

import { NextResponse } from "next/server";
import { generateDiagnostico } from "../../../lib/gemini";
import { qaDrills } from "../../../lib/qa";
import { logRun } from "../../../lib/oplog";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  const full = new URL(req.url).searchParams.get("full") === "1";
  const env = {
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
    GEMINI_MODEL: process.env.GEMINI_MODEL || "(default gemini-2.5-flash)",
    GITHUB_PAT: Boolean(process.env.GITHUB_PAT),
  };

  if (!full) return NextResponse.json({ ok: true, env });

  const steps = {};
  const t0 = Date.now();
  try {
    const { data, model } = await generateDiagnostico({
      scores: { prueba: "Matemática M1", puntaje: "612", detalle: "Álgebra 9/20, Geometría 4/12" },
    });
    steps.diagnostico = {
      ok: true,
      ms: Date.now() - t0,
      model,
      ejes: (data.diagnostico || []).length,
      dias: (data.ruta || []).length,
      drills: (data.drills || []).length,
    };

    const t1 = Date.now();
    try {
      const q = await qaDrills(data.drills, data.prueba);
      steps.qa = { ok: true, ms: Date.now() - t1, ...q.qa };
    } catch (e) {
      steps.qa = { ok: false, ms: Date.now() - t1, error: String(e && e.message ? e.message : e) };
    }

    const t2 = Date.now();
    try {
      const r = await logRun({ type: "health_check", runId: `health_${Date.now()}`, steps });
      steps.oplog = { ok: r.ok, ms: Date.now() - t2, status: r.status || null, reason: r.reason || null };
    } catch (e) {
      steps.oplog = { ok: false, ms: Date.now() - t2, error: String(e && e.message ? e.message : e) };
    }

    return NextResponse.json({ ok: true, env, totalMs: Date.now() - t0, steps });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        env,
        totalMs: Date.now() - t0,
        steps,
        error: String(err && err.message ? err.message : err),
      },
      { status: 500 }
    );
  }
}
