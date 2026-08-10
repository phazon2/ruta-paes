import { GoogleGenAI } from "@google/genai";
import { getExam } from "./exams";

// 2.5-flash quedo deprecado para keys nuevas (404 NOT_FOUND en prod, 2026-08-05).
// Cadena de respaldo: si un modelo devuelve 503/429 (demanda alta o cuota), el
// agente reintenta solo con el siguiente. Queda registrado en el log del run.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
export const MODEL_CHAIN = [MODEL, "gemini-flash-latest", "gemini-3.5-flash", "gemini-2.0-flash"];

function esTransitorio(err) {
  const s = String((err && err.message) || err);
  return /50[0-9]|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(s);
}

export async function generateConFallback(ai, req) {
  let ultimo;
  for (const m of MODEL_CHAIN) {
    try {
      const res = await ai.models.generateContent({ ...req, model: m });
      return { res, model: m };
    } catch (e) {
      ultimo = e;
      if (!esTransitorio(e)) throw e;
      console.log(JSON.stringify({ type: "model_fallback", from: m, reason: String(e.message || e).slice(0, 120) }));
    }
  }
  throw ultimo;
}

const promptFor = (exam) => `Eres el motor de diagnóstico de Ruta ${exam.nombre}, un servicio que convierte el resultado del último ${exam.ensayo} de un estudiante de ${exam.pais} en un plan de estudio dirigido de 14 días para el examen ${exam.nombreLargo} (${exam.nombre}).

Ejes temáticos oficiales de ${exam.organismo} por prueba:
${exam.ejes}

Tu tarea, en ${exam.dialecto}, tono directo y motivador (sin condescendencia):
1. DIAGNÓSTICO: identifica el rendimiento por eje temático a partir del input (informe/reporte en imagen/PDF, o puntajes escritos). Si el informe trae detalle por área/eje, úsalo; si solo hay puntaje global, infiere prudentemente y dilo en la evidencia.
2. DRILLS: ejercicios ORIGINALES con el formato real de ${exam.nombre} (alternativas A-D) para los 2 ejes más débiles. NUNCA copies ítems reales de ${exam.organismo}. Incluye solución paso a paso en ${exam.dialecto} claro.
3. RUTA de 14 días: prioriza los ejes débiles con mayor peso en el examen. Cada día = un foco concreto y una tarea realizable en 45-60 min. Explica el porqué de cada día en una frase.

Responde SOLO con JSON válido, exactamente con esta estructura. Respeta este
orden de claves: si la respuesta se corta, lo que se pierde debe ser el final
de la ruta y nunca los drills.
{
  "resumen": "2-3 frases: dónde está el estudiante y qué va a lograr con la ruta",
  "prueba": "nombre de la prueba diagnosticada",
  "diagnostico": [
    { "eje": "nombre del eje", "nivel": "fuerte" | "medio" | "debil", "evidencia": "1 frase con la base de esta evaluación" }
  ],
  "drills": [
    { "eje": "eje", "enunciado": "enunciado original con el formato del examen", "alternativas": ["A) ...", "B) ...", "C) ...", "D) ..."], "correcta": "A", "solucion": "solución paso a paso" }
  ],
  "ruta": [
    { "dia": 1, "foco": "eje/tema del día", "tarea": "tarea concreta de 45-60 min", "porque": "1 frase" }
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

  const req = {
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 16384,
    },
  };

  // El modelo trunca la salida seguido: medido en produccion, 3 de 5 respuestas
  // llegaban con menos de 14 dias y sin ningun drill. El parser tolerante las
  // reparaba en silencio, asi que el pack incompleto se entregaba igual. Ahora
  // se valida y se reintenta una vez; si sigue incompleto, se marca para que
  // nadie lo mande sin saberlo.
  let { res, model } = await generateConFallback(ai, req);
  let data = extractJson(res.text);

  if (!packCompleto(data)) {
    console.log(JSON.stringify({
      type: "pack_incompleto",
      intento: 1,
      dias: (data.ruta || []).length,
      drills: (data.drills || []).length,
    }));
    try {
      const r2 = await generateConFallback(ai, req);
      const d2 = extractJson(r2.res.text);
      // nos quedamos con el mejor de los dos, no con el ultimo
      if (puntajeCompletitud(d2) > puntajeCompletitud(data)) {
        data = d2;
        model = r2.model;
      }
    } catch (e) {
      console.log(JSON.stringify({ type: "pack_retry_fallo", reason: String(e && e.message ? e.message : e).slice(0, 120) }));
    }
  }

  data.completo = packCompleto(data);
  data.dias = (data.ruta || []).length;
  data.totalDrills = (data.drills || []).length;

  return { data, model, exam: exam.id };
}

// Un pack completo son 14 dias y los 2 ejercicios. Menos que eso es menos de lo
// que promete el paywall.
export function packCompleto(data) {
  return (data.ruta || []).length >= 14 && (data.drills || []).length >= 2;
}

function puntajeCompletitud(data) {
  return Math.min((data.ruta || []).length, 14) + (data.drills || []).length * 10;
}
