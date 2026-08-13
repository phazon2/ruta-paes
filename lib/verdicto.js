// Motor genérico de veredictos para los 4 negocios nuevos.
// Reusa cliente, parser tolerante y cadena de respaldo de modelos de lib/gemini.js.

import { GoogleGenAI } from "@google/genai";
import { detectarIngles, extractJson, generateConFallback } from "./gemini";
import { getProduct } from "./products";

function promptFor(p) {
  return `${p.prompt}

Responde SOLO con JSON válido, exactamente con esta estructura:
${p.schema}

Sé concreto y breve: cada tarea en una línea, cada explicación en máximo 2 frases.
Nunca inventes datos que no estén en el input: si falta información, dilo en la evidencia.

IDIOMA — regla dura: TODOS los valores del JSON van en español de Chile, sin una sola palabra en inglés, incluidos los títulos y los focos. Un artefacto que mezcla idiomas se ve como una traducción automática y el que lo paga lo nota.`;
}

export async function generateVerdicto({ productId, fileBase64, mimeType, texto }) {
  const p = getProduct(productId);
  if (!p) throw new Error("Producto desconocido");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  const ai = new GoogleGenAI({ apiKey });

  const parts = [{ text: promptFor(p) }];
  if (fileBase64 && mimeType) {
    parts.push({ text: `\nDocumento del usuario (${p.inputLabel}):` });
    parts.push({ inlineData: { mimeType, data: fileBase64 } });
  } else if (texto) {
    parts.push({ text: `\nSituación descrita por el usuario:\n${texto}` });
  } else {
    throw new Error("Falta el input: archivo o texto");
  }

  const req = {
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 16384 },
  };

  // Mismas dos guardas que el motor de Ruta PAES, por la misma razon medida ahi:
  // el modelo trunca la salida y el parser tolerante repara en silencio, asi que
  // un artefacto corto se entregaba sin que nadie se enterara. Y el reintento
  // solo cabe si queda tiempo: la funcion muere a los 60s.
  const t0 = Date.now();
  let { res, model } = await generateConFallback(ai, req);
  let data = extractJson(res.text);
  const msPrimerIntento = Date.now() - t0;

  if (!verdictoCompleto(data) && msPrimerIntento < 12000) {
    console.log(JSON.stringify({
      type: "verdicto_incompleto",
      producto: p.id,
      msPrimerIntento,
      pasos: (data.ruta || []).length,
      drills: (data.drills || []).length,
    }));
    try {
      const r2 = await generateConFallback(ai, req);
      const d2 = extractJson(r2.res.text);
      if (puntajeCompletitud(d2) > puntajeCompletitud(data)) {
        data = d2;
        model = r2.model;
      }
    } catch (e) {
      console.log(JSON.stringify({ type: "verdicto_retry_fallo", reason: String(e?.message || e).slice(0, 120) }));
    }
  }

  data.completo = verdictoCompleto(data);
  data.pasos = (data.ruta || []).length;
  data.totalDrills = (data.drills || []).length;
  data.ingles = detectarIngles(data);
  if (data.ingles.length) {
    console.log(JSON.stringify({ type: "verdicto_con_ingles", producto: p.id, palabras: data.ingles }));
  }

  return { data, model, producto: p.id };
}

// Los cuatro productos prometen un plan de 14 pasos y 2 artefactos accionables
// (la carta, el guion, la publicacion, la alerta). Menos que eso es menos de lo
// que dice el paywall.
export const PASOS_PROMETIDOS = 14;
export const DRILLS_PROMETIDOS = 2;
export function verdictoCompleto(data) {
  return (data.ruta || []).length >= PASOS_PROMETIDOS && (data.drills || []).length >= DRILLS_PROMETIDOS;
}

function puntajeCompletitud(data) {
  return Math.min((data.ruta || []).length, PASOS_PROMETIDOS) + (data.drills || []).length * 10;
}

// QA genérico: revisa que el artefacto sea accionable y no invente datos.
export async function qaVerdicto(data, productId) {
  const p = getProduct(productId);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!p || !apiKey) return { skipped: true, reason: "sin producto o api key" };

  const ai = new GoogleGenAI({ apiKey });
  const rubrica = `Eres el agente de QA de ${p.nombre}. Revisa este artefacto generado para un usuario real.

Criterios:
1. ACCIONABLE: cada tarea del plan dice QUÉ hacer, no un consejo genérico ("gasta menos", "sé constante" = falla).
2. FUNDADO: no afirma datos que el usuario no entregó (montos, fechas, nombres inventados = falla).
3. SEGURO: ${p.id === "derecho" ? "no promete resultados legales ni montos exactos, y aclara que no es asesoría legal" : p.id === "cartola" ? "no recomienda productos financieros específicos ni da consejos de inversión" : "no promete ingresos garantizados"}.
4. CLARO: español de Chile, sin jerga.

Responde SOLO JSON:
{ "verdicts": [ { "criterio": "accionable" | "fundado" | "seguro" | "claro", "verdict": "pass" | "fail", "motivo": "1 frase si falla" } ], "riesgo": "bajo" | "medio" | "alto" }`;

  const { res } = await generateConFallback(ai, {
    contents: [
      { role: "user", parts: [{ text: rubrica }, { text: `\nArtefacto:\n${JSON.stringify(data).slice(0, 12000)}` }] },
    ],
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });

  const parsed = extractJson(res.text);
  const verdicts = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
  return {
    skipped: false,
    riesgo: parsed.riesgo || null,
    revisados: verdicts.length,
    rechazados: verdicts.filter((v) => v.verdict === "fail").length,
    verdicts,
  };
}
