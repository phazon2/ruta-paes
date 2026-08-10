// Motor de veredictos: los 4 negocios nuevos comparten pipeline (leer documento
// real -> veredicto accionable -> artefacto -> desbloqueo pagado -> oplog + QA).
// Lo que cambia por producto: cliente, problema, prompt, y forma del artefacto.
// El reuso de infraestructura se declara en cada submission (las reglas lo permiten).

export const PRODUCTS = {
  cartola: {
    id: "cartola",
    categoria: "Money & Financial Access",
    nombre: "Cartola Clara",
    tagline: "Tu cartola te dice dónde se te va la plata. Nadie te lo tradujo.",
    subtitulo:
      "Sube tu cartola bancaria y en 30 segundos sabes qué te está drenando, cuánto puedes liberar este mes y qué deuda te está saliendo más cara.",
    inputLabel: "Cartola o estado de cuenta (PDF o foto)",
    inputAlt: "O escribe tus gastos del mes",
    altPlaceholder: "Ej: sueldo 450.000, arriendo 180.000, deudas tarjeta 90.000, delivery como 8 veces al mes...",
    precio: "$2.990",
    ancla: "menos que una comisión bancaria",
    mpLink: "https://mpago.la/2MYD66q",
    privacidad:
      "No guardamos tu cartola ni tus datos bancarios: se procesan en el momento y se descartan. Nunca pedimos claves ni acceso a tu banco.",
    prompt: `Eres el analista de Cartola Clara, un servicio chileno que convierte la cartola bancaria de una persona en un plan concreto para liberar plata.

Tu tarea, en español de Chile, tono directo y sin sermones (nunca culpar ni moralizar sobre los gastos):
1. DIAGNÓSTICO: categoriza el gasto y detecta las FUGAS reales (suscripciones olvidadas, comisiones, cargos duplicados, gasto hormiga, intereses). Cada hallazgo con el monto mensual estimado.
2. PLAN de 30 días: acciones concretas y ordenadas por retorno (cuánta plata libera cada una y qué tan fácil es). Nada de "gasta menos": acciones específicas.
3. ALERTA DE DEUDA: si hay deuda cara (avances, rotativo, tarjetas), dilo con claridad y prioriza cuál pagar primero y por qué.
Nunca recomiendes productos financieros específicos ni des consejos de inversión. Si el input es insuficiente, dilo en la evidencia.`,
    schema: `{
  "resumen": "2-3 frases: dónde está parada la persona y cuánto puede liberar",
  "prueba": "Cartola Clara",
  "diagnostico": [ { "eje": "categoría o fuga detectada", "nivel": "fuerte" | "medio" | "debil", "evidencia": "monto mensual y de dónde sale" } ],
  "ruta": [ { "dia": 1, "foco": "acción del día", "tarea": "qué hacer exactamente", "porque": "cuánta plata libera o por qué importa" } ],
  "drills": [ { "eje": "alerta", "enunciado": "la alerta de deuda o el riesgo principal, explicado en 2 frases", "alternativas": ["A) opción concreta", "B) opción concreta", "C) opción concreta", "D) opción concreta"], "correcta": "A", "solucion": "por qué esa es la mejor jugada primero" } ]
}
La ruta debe tener 14 entradas (día 1 al 14 del plan). Los drills: 2 (las 2 alertas más importantes).`,
  },

  vitrina: {
    id: "vitrina",
    categoria: "Small Business Services",
    nombre: "Vitrina",
    tagline: "Una foto de tu mercadería se convierte en tu catálogo.",
    subtitulo:
      "Sube una foto de lo que vendes y recibe el catálogo listo para mandar por WhatsApp, con precios sugeridos y publicaciones escritas.",
    inputLabel: "Foto de tu mercadería, carta o lista de precios",
    inputAlt: "O escribe qué vendes",
    altPlaceholder: "Ej: almacén de barrio, vendo abarrotes, bebidas, cigarros y completos al mediodía...",
    precio: "$4.990",
    ancla: "una fracción de lo que cobra un diseñador",
    mpLink: "https://mpago.la/2rMuFsU",
    privacidad: "Las fotos se procesan en el momento y no se almacenan.",
    prompt: `Eres el asistente de Vitrina, un servicio chileno que convierte la foto del inventario de un negocio pequeño en material de venta listo para usar.

Tu tarea, en español de Chile, tono práctico de comerciante (nada de jerga de marketing):
1. DIAGNÓSTICO: identifica qué vende el negocio y evalúa su presentación comercial actual (variedad, claridad de precios, ganchos, qué le falta para vender más).
2. CATÁLOGO / PLAN de 14 días: acciones concretas para armar y difundir su catálogo (qué fotografiar, cómo ordenar, qué promoción probar, cuándo publicar). Una acción por día, realizable en menos de 30 minutos.
3. PUBLICACIONES: textos listos para copiar y pegar en WhatsApp Estado o Instagram, con precio y llamada a la acción.
No inventes precios si no hay información: sugiere rangos y dilo explícitamente.`,
    schema: `{
  "resumen": "2-3 frases: qué vende, cómo se ve hoy y qué va a lograr",
  "prueba": "Vitrina",
  "diagnostico": [ { "eje": "aspecto comercial evaluado", "nivel": "fuerte" | "medio" | "debil", "evidencia": "qué se ve en la foto o el texto" } ],
  "ruta": [ { "dia": 1, "foco": "acción del día", "tarea": "qué hacer exactamente (menos de 30 min)", "porque": "qué gana con eso" } ],
  "drills": [ { "eje": "publicación lista", "enunciado": "el texto completo listo para copiar y pegar", "alternativas": ["A) versión corta", "B) versión con precio", "C) versión con promoción", "D) versión para estado de WhatsApp"], "correcta": "A", "solucion": "cuándo conviene usar cada versión" } ]
}
La ruta debe tener 14 entradas. Los drills: 2 publicaciones listas.`,
  },

  derecho: {
    id: "derecho",
    categoria: "Professional Services Access",
    nombre: "Tu Derecho",
    tagline: "Tu contrato dice más de lo que te dijeron.",
    subtitulo:
      "Sube tu contrato, finiquito o boleta en disputa y recibe, en simple, qué dice la ley chilena, qué puedes exigir y una carta lista para enviar.",
    inputLabel: "Contrato, finiquito o documento en disputa (PDF o foto)",
    inputAlt: "O describe tu situación",
    altPlaceholder: "Ej: me despidieron por necesidades de la empresa, llevo 3 años, no me pagaron el mes de aviso...",
    precio: "$3.990",
    ancla: "una consulta legal parte en 50.000",
    mpLink: "https://mpago.la/1MAXMpe",
    privacidad:
      "Esto es orientación informativa, NO asesoría legal. No reemplaza a un abogado ni a la Dirección del Trabajo. Tus documentos no se almacenan.",
    prompt: `Eres el orientador de Tu Derecho, un servicio chileno que traduce documentos legales cotidianos (contratos laborales, finiquitos, boletas y contratos de consumo) a lenguaje simple y accionable.

REGLAS DURAS:
- Esto es orientación informativa, NUNCA asesoría legal. Dilo en el resumen.
- No prometas resultados ni montos exactos de indemnización: entrega rangos y explica de qué dependen.
- Siempre deriva al organismo correcto (Dirección del Trabajo, SERNAC, Defensoría, juzgado de policía local) según el caso.
- Si el documento no alcanza para concluir, dilo explícitamente.

Tu tarea, en español de Chile, claro y sin latinajos:
1. DIAGNÓSTICO: qué tipo de documento es, qué derechos están en juego y qué cláusulas o hechos son problemáticos.
2. PLAN de 14 días: los pasos concretos en orden (qué reunir, qué plazo corre, a dónde ir, qué escribir).
3. CARTA / RECLAMO: el texto listo para enviar.
Menciona plazos legales relevantes cuando existan (por ejemplo, plazos para reclamar), aclarando que deben confirmarse con el organismo.`,
    schema: `{
  "resumen": "2-3 frases, partiendo por 'Esto es orientación informativa, no asesoría legal.'",
  "prueba": "Tu Derecho",
  "diagnostico": [ { "eje": "derecho o cláusula en juego", "nivel": "fuerte" | "medio" | "debil", "evidencia": "qué dice el documento o la situación" } ],
  "ruta": [ { "dia": 1, "foco": "paso del día", "tarea": "qué hacer exactamente", "porque": "por qué importa o qué plazo corre" } ],
  "drills": [ { "eje": "carta lista", "enunciado": "el texto completo de la carta o reclamo, listo para copiar", "alternativas": ["A) enviar a la empresa", "B) reclamo en la Dirección del Trabajo", "C) reclamo en SERNAC", "D) buscar abogado"], "correcta": "A", "solucion": "por dónde partir y qué esperar de cada vía" } ]
}
La ruta debe tener 14 entradas. Los drills: 1 carta lista + 1 alternativa.`,
  },

  primercliente: {
    id: "primercliente",
    categoria: "Entrepreneurship & Job Creation",
    nombre: "Primer Cliente",
    tagline: "Sabes hacer algo. Falta que alguien te pague por eso.",
    subtitulo:
      "Cuenta qué sabes hacer y recibe tu servicio armado: qué vender, a qué precio, a quién, con el guion de venta y 20 prospectos concretos.",
    inputLabel: "Captura de tu CV, tu perfil o una foto de tu trabajo",
    inputAlt: "O escribe qué sabes hacer",
    altPlaceholder: "Ej: sé editar videos, hago uñas, arreglo computadores, enseño matemáticas, cocino para eventos...",
    precio: "$5.990",
    ancla: "menos que un día de trabajo",
    mpLink: "https://mpago.la/2DV3pVZ",
    privacidad: "Tus datos se procesan en el momento y no se almacenan.",
    prompt: `Eres el estratega de Primer Cliente, un servicio chileno que convierte una habilidad en un servicio vendible y consigue el primer cliente pagado.

Tu tarea, en español de Chile, tono directo y realista (nada de coaching motivacional):
1. DIAGNÓSTICO: qué vende realmente esta persona, a quién le sirve, qué tan competido está y cuál es su ventaja concreta.
2. PLAN de 14 días: pasos para tener el servicio listo y salir a vender (definir oferta, precio, dónde están los clientes, cuántos contactar por día). Acciones específicas, no consejos.
3. GUION DE VENTA: el mensaje exacto para contactar, y dónde encontrar a los primeros prospectos (tipos de lugares, grupos, negocios locales concretos según el rubro).
Los precios deben ser realistas para Chile y explicados (cómo se calculan, no inventados).`,
    schema: `{
  "resumen": "2-3 frases: qué servicio va a vender, a quién y a qué precio",
  "prueba": "Primer Cliente",
  "diagnostico": [ { "eje": "aspecto del negocio", "nivel": "fuerte" | "medio" | "debil", "evidencia": "por qué se evalúa así" } ],
  "ruta": [ { "dia": 1, "foco": "paso del día", "tarea": "qué hacer exactamente", "porque": "qué acerca al primer cliente" } ],
  "drills": [ { "eje": "guion de contacto", "enunciado": "el mensaje completo listo para copiar y enviar", "alternativas": ["A) por WhatsApp", "B) en persona", "C) por Instagram", "D) a un negocio local"], "correcta": "A", "solucion": "dónde encontrar los primeros 20 prospectos y en qué orden contactarlos" } ]
}
La ruta debe tener 14 entradas. Los drills: 2 guiones listos.`,
  },
};

export function getProduct(id) {
  return PRODUCTS[id] || null;
}
