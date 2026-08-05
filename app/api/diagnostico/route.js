import { NextResponse } from "next/server";
import { generateDiagnostico } from "../../../lib/gemini";
import { qaDrills } from "../../../lib/qa";
import { logRun } from "../../../lib/oplog";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB tras decode aprox

export async function POST(req) {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();

  try {
    const body = await req.json();
    const { scores, fileBase64, mimeType } = body || {};

    if (fileBase64) {
      const approxBytes = Math.floor(fileBase64.length * 0.75);
      if (approxBytes > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "El archivo supera los 8 MB. Sube una foto más liviana o un PDF comprimido." },
          { status: 413 }
        );
      }
      const okTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!okTypes.includes(mimeType)) {
        return NextResponse.json(
          { error: "Formato no soportado. Usa JPG, PNG, WEBP o PDF." },
          { status: 415 }
        );
      }
    } else if (!scores || !scores.prueba || !scores.puntaje) {
      return NextResponse.json(
        { error: "Falta información: sube tu informe o escribe prueba y puntaje." },
        { status: 400 }
      );
    }

    const { data, model } = await generateDiagnostico({ scores, fileBase64, mimeType });

    // QA agent: revisa cada drill vs rubrica DEMRE; los fails vuelven corregidos.
    // Si el QA revienta, se entregan los drills originales (fail-safe).
    let qaResult = { skipped: true, reason: "error" };
    try {
      const q = await qaDrills(data.drills, data.prueba);
      data.drills = q.drills;
      qaResult = q.qa;
    } catch (e) {
      qaResult = { skipped: true, reason: "qa error: " + String(e && e.message ? e.message : e) };
    }

    // Agent-ops evidence: JSONL run log (console + persistente en branch "logs" del repo)
    const runLog = {
      type: "fulfillment_run",
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      model,
      inputMode: fileBase64 ? "file" : "scores",
      prueba: data.prueba || (scores && scores.prueba) || null,
      ejesDebiles: (data.diagnostico || []).filter((d) => d.nivel === "debil").map((d) => d.eje),
      qa: qaResult,
      ok: true,
    };
    console.log(JSON.stringify(runLog));
    try {
      await logRun(runLog);
    } catch (e) {
      console.log("oplog fail: " + String(e && e.message ? e.message : e));
    }

    return NextResponse.json({ runId, ...data });
  } catch (err) {
    const errLog = {
      type: "fulfillment_run",
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      error: String(err && err.message ? err.message : err),
    };
    console.log(JSON.stringify(errLog));
    try {
      await logRun(errLog);
    } catch (e) {
      console.log("oplog fail: " + String(e && e.message ? e.message : e));
    }
    return NextResponse.json(
      { error: "No pudimos generar tu diagnóstico. Intenta de nuevo en un momento." },
      { status: 500 }
    );
  }
}
