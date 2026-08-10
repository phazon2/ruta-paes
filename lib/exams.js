// Registro de exámenes. Agregar un país = agregar una entrada acá.
// El pipeline (diagnóstico -> ruta -> drills -> QA) es idéntico para todos.

export const EXAMS = {
  paes: {
    id: "paes",
    pais: "Chile",
    bandera: "🇨🇱",
    nombre: "PAES",
    nombreLargo: "Prueba de Acceso a la Educación Superior",
    organismo: "DEMRE",
    fecha: "2026-11-30",
    fechaTexto: "30 de noviembre",
    ensayo: "ensayo",
    moneda: "CLP",
    precio: "9.990",
    precioTexto: "$9.990 CLP",
    ancla: "menos que una hora de profe particular",
    // Link de monto fijo: el comprobante llega con el monto exacto y se concilia solo.
    mpLink: "https://mpago.la/31bsftj",
    contexto:
      "Preus en Chile cuestan entre CLP 1.000.000 y 3.000.000 al año. Los resultados de la PAES de Invierno se publicaron el 17 de julio de 2026.",
    pruebas: [
      "Competencia Lectora",
      "Matemática M1",
      "Matemática M2",
      "Ciencias",
      "Historia y Ciencias Sociales",
    ],
    ejes: `- Competencia Lectora: Localizar, Interpretar, Evaluar.
- Matemática M1: Números, Álgebra y funciones, Geometría, Probabilidad y estadística.
- Matemática M2: Números (reales/complejos), Álgebra y funciones avanzadas, Geometría analítica, Probabilidad y estadística avanzada.
- Ciencias: Biología, Física, Química + habilidades científicas.
- Historia y Ciencias Sociales: Historia en perspectiva (Chile/mundo), Formación ciudadana, Economía y sociedad.`,
    dialecto: "español de Chile",
  },

  icfes: {
    id: "icfes",
    pais: "Colombia",
    bandera: "🇨🇴",
    nombre: "ICFES Saber 11",
    nombreLargo: "Examen de Estado Saber 11",
    organismo: "ICFES",
    fecha: "2026-09-06",
    fechaTexto: "calendario A (agosto–septiembre)",
    ensayo: "simulacro",
    moneda: "COP",
    precio: "12.000",
    precioTexto: "$12.000 COP",
    ancla: "lo que cuesta un almuerzo",
    contexto:
      "Los preicfes en Colombia cuestan entre COP 500.000 y 2.000.000. El puntaje Saber 11 define acceso a universidad pública y a becas como Generación E.",
    pruebas: [
      "Lectura Crítica",
      "Matemáticas",
      "Ciencias Naturales",
      "Sociales y Ciudadanas",
      "Inglés",
    ],
    ejes: `- Lectura Crítica: identificar y entender contenidos locales, comprender la articulación del texto, reflexionar y evaluar.
- Matemáticas: numérico-variacional, geométrico-métrico, aleatorio; competencias de interpretación, formulación y argumentación.
- Ciencias Naturales: entorno vivo (biología), entorno físico (física y química), ciencia tecnología y sociedad (CTS).
- Sociales y Ciudadanas: pensamiento social, interpretación de perspectivas, pensamiento reflexivo y sistémico (Constitución, derechos, historia y geografía de Colombia).
- Inglés: niveles A1 a B1 del MCER (vocabulario, gramática en contexto, comprensión lectora).`,
    dialecto: "español de Colombia",
  },

  exani: {
    id: "exani",
    pais: "México",
    bandera: "🇲🇽",
    nombre: "EXANI-II",
    nombreLargo: "Examen Nacional de Ingreso a la Educación Superior",
    organismo: "CENEVAL",
    fecha: "2027-02-01",
    fechaTexto: "según convocatoria de tu universidad",
    ensayo: "simulacro",
    moneda: "MXN",
    precio: "60",
    precioTexto: "$60 MXN",
    ancla: "lo que cuestan unos tacos",
    contexto:
      "Los cursos de preparación para el EXANI-II cuestan entre MXN 3.000 y 15.000. El examen define ingreso a universidades públicas.",
    pruebas: [
      "Pensamiento Matemático",
      "Comprensión Lectora",
      "Redacción Indirecta",
      "Módulos disciplinares",
    ],
    ejes: `- Pensamiento Matemático: razonamiento aritmético, algebraico, estadístico-probabilístico, geométrico y trigonométrico.
- Comprensión Lectora: comprensión literal, inferencial y crítica de textos.
- Redacción Indirecta: mecánica de la lengua, coherencia, cohesión, normativa.
- Módulos disciplinares (según carrera): física, química, biología, ciencias sociales, matemáticas avanzadas, lengua y comunicación.`,
    dialecto: "español de México",
  },

  peru: {
    id: "peru",
    pais: "Perú",
    bandera: "🇵🇪",
    nombre: "Examen de Admisión",
    nombreLargo: "Examen de Admisión Universitaria (Perú)",
    organismo: "universidades",
    fecha: "2026-09-01",
    fechaTexto: "según convocatoria de tu universidad",
    ensayo: "simulacro",
    moneda: "PEN",
    precio: "12",
    precioTexto: "S/ 12",
    ancla: "lo que cuesta un menú",
    contexto:
      "Las academias preuniversitarias en Perú cuestan entre S/ 3.000 y 12.000 por ciclo. Los exámenes de admisión (UNMSM, UNI, PUCP y otras) definen el ingreso.",
    pruebas: [
      "Razonamiento Matemático",
      "Razonamiento Verbal",
      "Aritmética y Álgebra",
      "Geometría y Trigonometría",
      "Ciencias (Física, Química, Biología)",
      "Humanidades",
    ],
    ejes: `- Razonamiento Matemático: sucesiones, planteo de ecuaciones, situaciones lógicas, conteo.
- Razonamiento Verbal: comprensión lectora, analogías, series verbales, eliminación de oraciones.
- Aritmética y Álgebra: proporcionalidad, porcentajes, ecuaciones, funciones, logaritmos.
- Geometría y Trigonometría: triángulos, circunferencia, áreas, volúmenes, identidades.
- Ciencias: física (cinemática, dinámica, energía), química (materia, reacciones, estequiometría), biología (célula, sistemas, genética).
- Humanidades: historia del Perú y universal, geografía, economía, cívica, literatura, filosofía.`,
    dialecto: "español del Perú",
  },
};

export const DEFAULT_EXAM = "paes";

// Mapeo país (header de Vercel) -> examen por defecto
export const COUNTRY_TO_EXAM = {
  CL: "paes",
  CO: "icfes",
  MX: "exani",
  PE: "peru",
};

export function getExam(id) {
  return EXAMS[id] || EXAMS[DEFAULT_EXAM];
}

export function semanasRestantes(exam) {
  const ms = new Date(exam.fecha + "T08:00:00-03:00") - Date.now();
  return Math.max(1, Math.ceil(ms / 604800000));
}
