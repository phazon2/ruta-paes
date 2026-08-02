import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const EJES = `
Ejes temáticos oficiales DEMRE por prueba:
- Competencia Lectora: Localizar, Interpretar, Evaluar.
- Matemática M1: Números, Álgebra y funciones, Geometría, Probabilidad y estadística.
- Matemática M2: Números (reales/complejos), Álgebra y funciones avanzadas, Geometría analítica, Probabilidad y estadística avanzada.
- Ciencias: Biología, Física, Química + habilidades científicas (según módulo del estudiante).
- Historia y Ciencias Sociales: Historia en perspectiva (Chile/mundo), Formación ciudadana, Economía y sociedad.
`;

const PROMPT_BASE = `Eres el motor de diagnóstico de Ruta PAES, un servicio chileno que convierte el resultado del último ensayo PAES de un estudiante en un plan de estudio dirigido de 14 días.

${EJES}

Tu tarea, en español de Chile, tono directo y motivador (sin condescendencia):
1. DIAGNÓSTICO: identifica el rendimiento por eje temático a partir del input (informe de ensayo en imagen/PDF, o puntajes escritos). Si el informe trae detalle por área/eje, úsalo; si solo hay puntaje global, infiere prudentemente y dilo en la evidencia.
2. RUTA de 14 días: prioriza los ejes débiles con mayor peso en la prueba. Cada día = un foco concreto y una tarea realizable en 45-60 min. Explica el porqué de cada día en una frase.
3. DRILLS: ejercicios ORIGINALES estilo DEMRE (formato de alternativas A-D) para los 2 ejes más débiles, 2 por eje. NUNCA copies ítems reales de DEMRE. Incluye solución paso a paso en chileno claro.

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
    { "eje": "eje", "enunciado": "enunciado original estilo DEMRE", "alternativas": ["A) ...", "B) ...", "C) ...", "D) ..."], "correcta": "A", "solucion": "solución paso a paso" }
  ]
}
La ruta debe tener exactamente 14 días. Los drills: 4 en total (2 por cada eje débil).`;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  return new GoogleGenAI({ apiKey });
}

function extractJson(text) {
  if (!text) throw new Error("Respuesta vacía del modelo");
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La respuesta no contiene JSON");
  return JSON.parse(t.slice(start, end + 1));
}

/**
 * input: { scores?: { prueba, puntaje, detalle }, fileBase64?: string, mimeType?: string }
 */
export async function generateDiagnostico(input) {
  const ai = getClient();
  const parts = [{ text: PROMPT_BASE }];

  if (input.fileBase64 && input.mimeType) {
    parts.push({ text: "\nInforme de ensayo del estudiante (leer todo el detalle disponible):" });
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
    config: { responseMimeType: "application/json", temperature: 0.4 },
  });

  const data = extractJson(res.text);
  return { data, model: MODEL };
}
