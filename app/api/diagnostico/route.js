import { NextResponse } from "next/server";
import { generateDiagnostico, mensajeUsuario } from "../../../lib/gemini";
import { qaDrills } from "../../../lib/qa";
import { logRun } from "../../../lib/oplog";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB tras decode aprox

// El pack completo se recorta EN EL SERVIDOR. Antes viajaban los 14 dias y las
// dos soluciones al navegador y la pagina solo los tapaba con un blur: bastaba
// abrir la pestaña de red, o adivinar ?pack=1, para llevarse gratis lo que se
// cobra. Lo que no se pago no sale de aca.
//
// Falla cerrado a proposito: sin PACK_KEY configurada nadie recibe el pack
// completo, ni siquiera el operador. Preferimos bloquear a Diego que regalar
// el producto.
function esOperador(packKey) {
  const real = process.env.PACK_KEY || "";
  return real.length > 0 && packKey === real;
}

function recortarParaVisitante(data) {
  const drills = (data.drills || []).slice(0, 2).map((d, i) => {
    if (i === 0) return d; // el primer ejercicio va completo: es la muestra
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

  try {
    const body = await req.json();
    const { scores, fileBase64, mimeType, examId, packKey } = body || {};
    const operador = esOperador(packKey);

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

    const { data, model, exam } = await generateDiagnostico({ scores, fileBase64, mimeType, examId });

    // QA agent: revisa cada drill vs rubrica DEMRE; los fails vuelven corregidos.
    // Si el QA revienta, se entregan los drills originales (fail-safe).
    let qaResult = { skipped: true, reason: "error" };
    try {
      // Presupuesto duro y ADAPTATIVO: la funcion muere a los 60s. Lo que le
      // demos al QA es lo que sobra tras la generacion, con 8s de colchon para
      // serializar y loguear. Si no sobra nada, se entrega sin QA: un pack sin
      // revisar es peor que uno revisado, pero infinitamente mejor que un
      // timeout que no entrega nada.
      const qaMs = Math.min(18000, 48000 - (Date.now() - tStart));
      if (qaMs < 4000) throw new Error(`sin presupuesto para QA (quedaban ${qaMs}ms)`);
      const q = await Promise.race([
        qaDrills(data.drills, data.prueba, examId),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`qa timeout ${qaMs}ms`)), qaMs)),
      ]);
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
      exam,
      inputMode: fileBase64 ? "file" : "scores",
      prueba: data.prueba || (scores && scores.prueba) || null,
      ejesDebiles: (data.diagnostico || []).filter((d) => d.nivel === "debil").map((d) => d.eje),
      qa: qaResult,
      // completitud del pack: sin esto, un pack corto se entrega sin dejar rastro
      packCompleto: data.completo === true,
      dias: (data.ruta || []).length,
      drills: (data.drills || []).length,
      entrega: operador ? "pack" : "muestra",
      totalMs: Date.now() - tStart,
      ok: true,
    };
    console.log(JSON.stringify(runLog));
    try {
      await logRun(runLog);
    } catch (e) {
      console.log("oplog fail: " + String(e && e.message ? e.message : e));
    }

    return NextResponse.json({
      runId,
      full: operador,
      // headroom contra el techo de 60s, medible desde afuera sin abrir Vercel
      totalMs: Date.now() - tStart,
      packKeyConfigurada: Boolean(process.env.PACK_KEY),
      ...(operador ? data : recortarParaVisitante(data)),
    });
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
      {
        error: mensajeUsuario(err),
        runId,
      },
      { status: 500 }
    );
  }
}
