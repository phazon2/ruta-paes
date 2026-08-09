// Motor genérico de veredictos para los 4 negocios nuevos.
// Reusa cliente, parser tolerante y cadena de respaldo de modelos de lib/gemini.js.

import { GoogleGenAI } from "@google/genai";
import { extractJson, generateConFallback } from "./gemini";
import { getProduct } from "./products";

function promptFor(p) {
  return `${p.prompt}

Responde SOLO con JSON válido, exactamente con esta estructura:
${p.schema}

Sé concreto y breve: cada tarea en una línea, cada explicación en máximo 2 frases.
Nunca inventes datos que no estén en el input: si falta información, dilo en la evidencia.`;
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

  const { res, model } = await generateConFallback(ai, {
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 16384 },
  });

  return { data: extractJson(res.text), model, producto: p.id };
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
