import { NextResponse } from "next/server";
import { generateVerdicto, qaVerdicto } from "../../../lib/verdicto";
import { logRun } from "../../../lib/oplog";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(req) {
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();
  let productId = null;

  try {
    const body = await req.json();
    const { fileBase64, mimeType, texto } = body || {};
    productId = body?.productId;

    if (fileBase64) {
      if (Math.floor(fileBase64.length * 0.75) > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "El archivo supera los 8 MB." }, { status: 413 });
      }
      const ok = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!ok.includes(mimeType)) {
        return NextResponse.json({ error: "Usa JPG, PNG, WEBP o PDF." }, { status: 415 });
      }
    } else if (!texto || texto.trim().length < 15) {
      return NextResponse.json(
        { error: "Sube un documento o describe tu situación con un poco más de detalle." },
        { status: 400 }
      );
    }

    const { data, model, producto } = await generateVerdicto({ productId, fileBase64, mimeType, texto });

    let qa = { skipped: true, reason: "error" };
    try {
      qa = await Promise.race([
        qaVerdicto(data, productId),
        new Promise((_, rej) => setTimeout(() => rej(new Error("qa timeout 18s")), 18000)),
      ]);
    } catch (e) {
      qa = { skipped: true, reason: String(e?.message || e) };
    }

    const runLog = {
      type: "verdicto_run",
      producto,
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      model,
      inputMode: fileBase64 ? "file" : "texto",
      hallazgos: (data.diagnostico || []).length,
      pasos: (data.ruta || []).length,
      qa,
      ok: true,
    };
    console.log(JSON.stringify(runLog));
    try {
      await logRun(runLog);
    } catch (_) {}

    return NextResponse.json({ runId, qa, ...data });
  } catch (err) {
    const errLog = {
      type: "verdicto_run",
      producto: productId,
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      error: String(err?.message || err),
    };
    console.log(JSON.stringify(errLog));
    try {
      await logRun(errLog);
    } catch (_) {}
    return NextResponse.json(
      { error: "No pudimos generar tu resultado. Intenta de nuevo en un momento.", detalle: String(err?.message || err) },
      { status: 500 }
    );
  }
}
