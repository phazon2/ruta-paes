// QA agent: segundo pase de Gemini que revisa cada drill generado contra una
// rubrica (formato DEMRE, alineacion al temario, correccion de la solucion,
// espanol chileno claro). Los drills que fallan vuelven corregidos.
// Decision de produccion tomada por IA + logueada = evidencia AI-Native Ops.
// Fail-safe: si el QA falla, se entregan los drills originales.

import { GoogleGenAI } from "@google/genai";
import { extractJson, generateConFallback } from "./gemini";
import { getExam } from "./exams";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const rubricaFor = (exam) => `Eres el agente de QA de Ruta ${exam.nombre}. Revisa CADA ejercicio contra esta rubrica:
1. FORMATO: enunciado claro y autocontenido, exactamente 4 alternativas A-D, una sola correcta.
2. TEMARIO: el contenido corresponde al eje declarado y al temario oficial de ${exam.organismo} para el examen ${exam.nombre} (nivel escolar de ${exam.pais}, no universitario).
3. SOLUCION: resuelve el ejercicio de forma independiente; la alternativa marcada como correcta DEBE ser la correcta y la solucion paso a paso debe ser valida y llegar a esa alternativa.
4. LENGUAJE: ${exam.dialecto} claro, sin ambiguedades, sin copiar items reales de ${exam.organismo}.

Para cada ejercicio entrega un veredicto. Si falla cualquier criterio, marca "fail",
explica el motivo en una frase y entrega la version corregida completa del ejercicio
(mismo eje, misma dificultad aproximada).

Responde SOLO JSON valido:
{
  "verdicts": [
    {
      "index": 0,
      "verdict": "pass" | "fail",
      "motivo": "1 frase (solo si fail)",
      "corregido": { "eje": "...", "enunciado": "...", "alternativas": ["A) ...","B) ...","C) ...","D) ..."], "correcta": "A", "solucion": "..." }
    }
  ]
}
El campo "corregido" solo va cuando verdict = "fail".`;

/**
 * Revisa drills. Devuelve { drills, qa } donde drills ya viene con los fails
 * reemplazados por su version corregida, y qa es el detalle para el oplog.
 */
export async function qaDrills(drills, prueba, examId) {
  if (!Array.isArray(drills) || drills.length === 0) {
    return { drills, qa: { skipped: true, reason: "sin drills" } };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { drills, qa: { skipped: true, reason: "sin api key" } };

  const ai = new GoogleGenAI({ apiKey });
  const exam = getExam(examId);
  const { res } = await generateConFallback(ai, {
    contents: [
      {
        role: "user",
        parts: [
          { text: rubricaFor(exam) },
          { text: `\nPrueba: ${prueba || "desconocida"}\nEjercicios a revisar (JSON):\n${JSON.stringify(drills)}` },
        ],
      },
    ],
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });

  const parsed = extractJson(res.text);
  const verdicts = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];

  const out = drills.slice();
  let fails = 0;
  for (const v of verdicts) {
    if (
      v &&
      v.verdict === "fail" &&
      Number.isInteger(v.index) &&
      v.index >= 0 &&
      v.index < out.length &&
      v.corregido &&
      v.corregido.enunciado &&
      Array.isArray(v.corregido.alternativas) &&
      v.corregido.alternativas.length === 4 &&
      v.corregido.correcta &&
      v.corregido.solucion
    ) {
      out[v.index] = { ...v.corregido, eje: v.corregido.eje || out[v.index].eje };
      fails++;
    }
  }

  return {
    drills: out,
    qa: {
      skipped: false,
      revisados: drills.length,
      rechazados: fails,
      verdicts: verdicts.map((v) => ({
        index: v.index,
        verdict: v.verdict,
        motivo: v.motivo || null,
      })),
    },
  };
}
