import { GoogleGenAI } from "@google/genai";
import { getExam } from "./exams";

// 2.5-flash quedo deprecado para keys nuevas (404 NOT_FOUND en prod, 2026-08-05)
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const promptFor = (exam) => `Eres el motor de diagnóstico de Ruta ${exam.nombre}, un servicio que convierte el resultado del último ${exam.ensayo} de un estudiante de ${exam.pais} en un plan de estudio dirigido de 14 días para el examen ${exam.nombreLargo} (${exam.nombre}).

Ejes temáticos oficiales de ${exam.organismo} por prueba:
${exam.ejes}

Tu tarea, en ${exam.dialecto}, tono directo y motivador (sin condescendencia):
1. DIAGNÓSTICO: identifica el rendimiento por eje temático a partir del input (informe/reporte en imagen/PDF, o puntajes escritos). Si el informe trae detalle por área/eje, úsalo; si solo hay puntaje global, infiere prudentemente y dilo en la evidencia.
2. RUTA de 14 días: prioriza los ejes débiles con mayor peso en el examen. Cada día = un foco concreto y una tarea realizable en 45-60 min. Explica el porqué de cada día en una frase.
3. DRILLS: ejercicios ORIGINALES con el formato real de ${exam.nombre} (alternativas A-D) para los 2 ejes más débiles. NUNCA copies ítems reales de ${exam.organismo}. Incluye solución paso a paso en ${exam.dialecto} claro.

Responde SOLO con JSON válido, exactamente con esta estructura:
{
  "resumen": "2-3 frases: dónde está el estudiante y qué va a lograr con la ruta",
  "prueba": "nombre de la prueba diagnosticada",
  "diagnostico": [
    { "eje": "nombre del eje", "nivel": "fuerte" | "medio" | "debil", "evidencia": "1 frase con la base de esta evaluación" }
  ],
  "ruta": [
    { "dia": 1, "foco": "eje/tema del día", "tarea": "tarea concreta de 45-60 min", "porque": "1 frase" }
  ],
  "drills": [
    { "eje": "eje", "enunciado": "enunciado original con el formato del examen", "alternativas": ["A) ...", "B) ...", "C) ...", "D) ..."], "correcta": "A", "solucion": "solución paso a paso" }
  ]
}
La ruta debe tener exactamente 14 días. Los drills: 2 en total (1 por cada uno de los 2 ejes más débiles).
Sé conciso: tareas de una línea, soluciones de máximo 4 pasos. Prioriza velocidad de respuesta.`;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenAI({ apiKey });
}

// Parser tolerante: los modelos a veces truncan la salida a mitad de un array.
// Si el JSON no parsea, lo reparamos cerrando strings/brackets abiertos y
// descartando el ultimo elemento incompleto.
export function extractJson(text) {
  if (!text) throw new Error("Respuesta vacía del modelo");
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  if (start === -1) throw new Error("La respuesta no contiene JSON");
  t = t.slice(start);

  try {
    return JSON.parse(t.slice(0, t.lastIndexOf("}") + 1));
  } catch (_) {
    /* seguimos a reparar */
  }

  // recorrer y registrar el estado de brackets/strings
  const stack = [];
  let inStr = false;
  let esc = false;
  let lastSafe = -1; // posicion tras un elemento completo dentro del array/objeto mas externo
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
    else if (c === "," && stack.length <= 2) lastSafe = i;
  }

  const base = lastSafe > 0 ? t.slice(0, lastSafe) : t.replace(/,\s*$/, "");
  // recalcular cierres pendientes para el fragmento recortado
  const need = [];
  inStr = false;
  esc = false;
  for (let i = 0; i < base.length; i++) {
    const c = base[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") need.push("}");
    else if (c === "[") need.push("]");
    else if (c === "}" || c === "]") need.pop();
  }
  const repaired = base + (inStr ? '"' : "") + need.reverse().join("");
  return JSON.parse(repaired);
}

/**
 * input: { scores?: { prueba, puntaje, detalle }, fileBase64?: string, mimeType?: string }
 */
export async function generateDiagnostico(input) {
  const ai = getClient();
  const exam = getExam(input.examId);
  const parts = [{ text: promptFor(exam) }];

  if (input.fileBase64 && input.mimeType) {
    parts.push({ text: `\nInforme de ${exam.ensayo} del estudiante (leer todo el detalle disponible):` });
    parts.push({ inlineData: { mimeType: input.mimeType, data: input.fileBase64 } });
  } else if (input.scores) {
    parts.push({
      text: `\nPuntajes escritos por el estudiante:\nPrueba: ${input.scores.prueba}\nPuntaje: ${input.scores.puntaje}\nDetalle adicional (puede incluir aciertos por área, omitidas, etc.): ${input.scores.detalle || "sin detalle"}`,
    });
  } else {
    throw new Error("Falta el input: archivo o puntajes");
  }

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 16384,
    },
  });

  const data = extractJson(res.text);
  return { data, model: MODEL, exam: exam.id };
}
