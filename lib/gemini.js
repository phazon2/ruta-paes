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
La ruta debe tener exactamente 14 días. Los drills: 4 en total, 2 por cada uno de los 2 ejes más débiles (el paywall promete ejercicios por cada eje débil, en plural: 1 por eje deja corta la promesa).

IDIOMA — regla dura: TODOS los valores del JSON van en ${exam.dialecto}, sin una sola palabra en inglés. Esto incluye los "foco" de cada día y los campos "evidencia". Escribe "Inferido a partir de…", nunca "Inferred". Escribe "La célula y sus organelos", nunca "Cell & Organelos". Los nombres de conceptos científicos y matemáticos van en español. Un pack que mezcla idiomas se ve como una traducción automática y el estudiante que lo paga lo nota.

Cuando varios ejes se infieran del mismo puntaje global, no repitas la misma frase en cada uno: di en qué se diferencia tu lectura de cada eje.
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
  const t0 = Date.now();
  let { res, model } = await generateConFallback(ai, req);
  let data = extractJson(res.text);
  const msPrimerIntento = Date.now() - t0;

  // El reintento solo cabe si queda tiempo. La funcion muere a los 60s (limite
  // del plan) y la ruta multimodal —subir una foto o PDF, que es como entra la
  // mayoria— se come la mitad del presupuesto solo en el primer intento.
  // Reintentar a ciegas ahi devolvia FUNCTION_INVOCATION_TIMEOUT: el estudiante
  // no recibia nada. Vale mas un pack corto que un error.
  // 12s, no 20s. Con 20s se midio una corrida de 57,4s contra un techo de 60:
  // primer intento de ~19s + reintento de ~30s + QA. Sobrevivio por 2,6s, que
  // no es un margen, es suerte. A 12s el peor caso queda cerca de 50s.
  // Cuesta algunos packs incompletos mas; para eso esta el aviso al operador.
  const PRESUPUESTO_REINTENTO_MS = 12000;
  const hayTiempo = msPrimerIntento < PRESUPUESTO_REINTENTO_MS;

  if (!packCompleto(data) && !hayTiempo) {
    console.log(JSON.stringify({
      type: "pack_incompleto_sin_reintento",
      motivo: "sin presupuesto de tiempo",
      msPrimerIntento,
      dias: (data.ruta || []).length,
      drills: (data.drills || []).length,
    }));
  }

  if (!packCompleto(data) && hayTiempo) {
    console.log(JSON.stringify({
      type: "pack_incompleto",
      intento: 1,
      msPrimerIntento,
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
  data.entregable = packEntregable(data);
  data.dias = (data.ruta || []).length;
  data.totalDrills = (data.drills || []).length;
  data.ingles = detectarIngles(data);
  if (data.ingles.length) {
    console.log(JSON.stringify({ type: "pack_con_ingles", palabras: data.ingles }));
  }

  return { data, model, exam: exam.id };
}

// Un pack completo son 14 dias y los 2 ejercicios. Menos que eso es menos de lo
// que promete el paywall.
export const DRILLS_PROMETIDOS = 4; // 2 por cada uno de los 2 ejes debiles
export const DIAS_PROMETIDOS = 14;
export const DIAS_MINIMOS = 12;

// Dos umbrales, no uno. Medido en los 4 paises: 2 de 8 corridas volvieron con
// 13 dias en vez de 14. Un pack de 13 dias con sus 4 ejercicios es perfectamente
// entregable; bloquear al operador por un dia lo manda a regenerar 1 de cada 4
// veces sin ninguna razon, y un aviso que salta cuando no pasa nada deja de
// leerse justo cuando si pasa algo.
export function packCompleto(data) {
  return (data.ruta || []).length >= DIAS_PROMETIDOS && (data.drills || []).length >= DRILLS_PROMETIDOS;
}

// Lo que si justifica bloquear: faltan ejercicios (es lo que se cobra) o la ruta
// quedo destrozada. Se han visto corridas de 2 y 3 dias.
export function packEntregable(data) {
  return (data.ruta || []).length >= DIAS_MINIMOS && (data.drills || []).length >= DRILLS_PROMETIDOS;
}

function puntajeCompletitud(data) {
  return Math.min((data.ruta || []).length, 14) + (data.drills || []).length * 10;
}

// Deteccion de ingles filtrado, en codigo y sin costo de tokens. El agente de QA
// solo mira los ejercicios, asi que el diagnostico y la ruta no los revisaba
// nadie: un pack entregado a un cliente real salio con "Inferred a partir del
// puntaje global" cuatro veces y con un dia titulado "Cell & Organelos".
//
// Lista corta y sin ambiguedad: palabras que no existen en espanol. Nada de
// "test", "score" ni "key", que si se usan en Chile.
const PALABRAS_INGLESAS = [
  "inferred", "based", "overview", "summary", "review", "practice", "skills",
  "week", "cell", "organelles", "chapter", "workbook", "worksheet", "improve",
  "strengthen", "the", "and", "with", "your", "from", "this", "that", "will",
];
const RE_INGLES = new RegExp(`\\b(${PALABRAS_INGLESAS.join("|")})\\b`, "gi");

export function detectarIngles(data) {
  const encontradas = new Set();
  const visitar = (v) => {
    if (typeof v === "string") {
      for (const m of v.match(RE_INGLES) || []) encontradas.add(m.toLowerCase());
    } else if (Array.isArray(v)) {
      v.forEach(visitar);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(visitar);
    }
  };
  // solo el contenido que ve el estudiante, no los metadatos
  ["resumen", "prueba", "diagnostico", "ruta", "drills"].forEach((k) => visitar(data[k]));
  return [...encontradas];
}
