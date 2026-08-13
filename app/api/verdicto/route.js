import { NextResponse } from "next/server";
import { generateVerdicto, qaVerdicto } from "../../../lib/verdicto";
import { logRun } from "../../../lib/oplog";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

// Mismo candado que /api/diagnostico y por la misma razon: sin esto el plan
// completo y las dos soluciones viajan al navegador y la pagina solo los tapa
// con un blur. Cualquiera con la pestaña de red abierta se lleva gratis lo que
// se cobra. Falla cerrado: sin PACK_KEY nadie recibe el pack, ni el operador.
function esOperador(packKey) {
  const real = process.env.PACK_KEY || "";
  return real.length > 0 && packKey === real;
}

function recortarParaVisitante(data) {
  const drills = (data.drills || []).slice(0, 2).map((d, i) => {
    if (i === 0) return d; // el primero va completo: es la muestra
    const { solucion, correcta, ...sinRespuesta } = d;
    return sinRespuesta;
  });
  return {
    ...data,
    ruta: (data.ruta || []).slice(0, 8), // 5 visibles + 3 borrosos
    drills,
  };
}

export async function POST(req) {
  const tStart = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();
  let productId = null;

  try {
    const body = await req.json();
    const { fileBase64, mimeType, texto, packKey } = body || {};
    productId = body?.productId;
    const operador = esOperador(packKey);

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
      // Presupuesto adaptativo, igual que en /api/diagnostico: al QA le toca lo
      // que sobra de los 60s con colchon. Sin esto, un documento pesado mas un
      // reintento empujan la funcion sobre el techo y el usuario no recibe nada.
      const qaMs = Math.min(18000, 48000 - (Date.now() - tStart));
      if (qaMs < 4000) throw new Error(`sin presupuesto para QA (quedaban ${qaMs}ms)`);
      qa = await Promise.race([
        qaVerdicto(data, productId),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`qa timeout ${qaMs}ms`)), qaMs)),
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
      drills: (data.drills || []).length,
      artefactoCompleto: data.completo === true,
      entrega: operador ? "pack" : "muestra",
      ingles: data.ingles || [],
      totalMs: Date.now() - tStart,
      qa,
      ok: true,
    };
    console.log(JSON.stringify(runLog));
    try {
      await logRun(runLog);
    } catch (_) {}

    return NextResponse.json({
      runId,
      qa,
      full: operador,
      packKeyConfigurada: Boolean(process.env.PACK_KEY),
      totalMs: Date.now() - tStart,
      ...(operador ? data : recortarParaVisitante(data)),
    });
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
