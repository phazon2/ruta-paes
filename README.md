# Ruta PAES

**Tu último ensayo se convierte en tu plan.** Subes la foto del informe de tu ensayo y en
menos de un minuto tienes un diagnóstico por eje temático oficial, una ruta de 14 días y
ejercicios originales con solución — por CLP 9.990.

**Live:** https://ruta-paes.vercel.app · [`/paes`](https://ruta-paes.vercel.app/paes) ·
[`/icfes`](https://ruta-paes.vercel.app/icfes) · [`/exani`](https://ruta-paes.vercel.app/exani) ·
[`/peru`](https://ruta-paes.vercel.app/peru)

---

## El problema, con un número

Un preuniversitario en Chile cuesta entre **CLP 1.000.000 y 3.000.000 al año**. Lo que vende
no es contenido — el contenido es gratis y sobra. Lo que vende es *saber qué hacer mañana*.
Esa es la parte que un estudiante no puede comprar por separado, y es la que decide el
resultado.

Ruta PAES vende exactamente esa parte, por 9.990.

**La afirmación estructural:** todos los preuniversitarios venden un año completo empaquetado,
y ninguno puede vender la capa de "qué estudio ahora" por separado sin destruir el paquete que
los financia. Es una barrera económica, no de ingeniería.

## Qué hace

1. El estudiante sube la foto o PDF del informe de su último ensayo (de cualquier preu), o
   escribe sus puntajes
2. Gemini lo lee de forma multimodal y diagnostica el rendimiento por **eje temático oficial**
   del organismo de cada país
3. Sale un artefacto: ruta de 14 días — un foco concreto y una tarea de 45–60 min por día,
   cada una con su porqué — más ejercicios originales en formato real de examen, 2 por cada
   eje débil, con solución paso a paso
4. Un agente de QA revisa cada ejercicio contra el temario oficial **antes** de que el
   estudiante lo vea
5. El estudiante escribe por WhatsApp, recibe el link de pago de monto fijo y el pack se
   entrega en la misma conversación

El contacto va **antes** del pago a propósito: Mercado Pago no devuelve al comprador al sitio,
así que cualquier instrucción posterior al pago queda en una pantalla que ya no ve. Con entrega
manual no se le cobra a alguien a quien no se puede escribir.

## Los diez pipelines

| # | Pipeline | Qué hace | Dónde |
|---|---|---|---|
| 1 | Lector multimodal | Ingiere foto o PDF del informe; probado hasta 1,5 MB | `lib/gemini.js` |
| 2 | Diagnóstico por eje | Mapea el rendimiento a los ejes oficiales de cada país | `lib/gemini.js` |
| 3 | Planificador de ruta | 14 días ordenados por peso del eje en el examen | `lib/gemini.js` |
| 4 | Generador de ejercicios | Ítems originales A–D; nunca copia ítems reales | `lib/gemini.js` |
| 5 | Agente de QA | Revisa cada ítem contra el temario; los que fallan vuelven corregidos | `lib/qa.js` |
| 6 | Cadena de respaldo de modelos | Ante 503/429 reintenta por 4 modelos y registra el cambio | `lib/gemini.js` |
| 7 | Guarda de completitud | Valida el pack contra lo prometido; reintenta y se queda con el mejor intento | `lib/gemini.js` |
| 8 | Gobernador de tiempo | Reparte el techo de 60s entre etapas; degrada en vez de morir por timeout | `app/api/diagnostico/route.js` |
| 9 | Candado de entitlement | Lo pagado no sale del servidor sin clave; falla cerrado | `app/api/diagnostico/route.js` |
| 10 | Log de evidencia | Cada run escribe JSONL a la rama `logs` vía la API de GitHub | `lib/oplog.js` |

Auditable desde afuera sin abrir un dashboard:

```bash
curl -s "https://ruta-paes.vercel.app/api/health"          # env presentes (booleanos, nunca valores)
curl -s "https://ruta-paes.vercel.app/api/health?full=1"   # corre el pipeline completo con tiempos por etapa
bash state-dump.sh                                          # estado desplegado en un archivo
```

## Dónde se niega

Cinco lugares donde la app declina en vez de adivinar.

1. **El agente de QA rechaza su propia salida.** De un run real del 2026-08-12:
   `"verdict": "fail", "motivo": "El contenido de homotecia no forma parte del temario oficial
   de M1 (corresponde a M2)."` El ítem estaba bien formado y pertenecía a otro examen. El
   estudiante nunca lo vio.
2. **Un pack incompleto se niega a ser entregado.** Si vuelven menos de 14 días o menos de 4
   ejercicios, la vista de entrega bloquea al operador con los conteos reales.
3. **El candado del pack falla cerrado.** Sin `PACK_KEY` nadie recibe el pack completo, ni el
   operador. Preferimos bloquear al fundador que filtrar el producto.
4. **El QA se salta a sí mismo antes que morir por timeout.** Si la generación se comió el
   presupuesto, el pack sale sin revisar y etiquetado como tal.
5. **El input insuficiente se dice, no se adivina.** Si el informe solo trae puntaje global, el
   diagnóstico lo declara en la evidencia en vez de inventar detalle por eje.

## Multipaís

| País | Ruta | Examen | Organismo | Moneda |
|---|---|---|---|---|
| 🇨🇱 Chile | `/paes` | PAES | DEMRE | CLP |
| 🇨🇴 Colombia | `/icfes` | ICFES Saber 11 | ICFES | COP |
| 🇲🇽 México | `/exani` | EXANI-II | CENEVAL | MXN |
| 🇵🇪 Perú | `/peru` | Examen de Admisión | — | PEN |

Cada uno con su temario oficial, su moneda, su cuenta regresiva y su dialecto. La raíz detecta
el país del visitante. **Agregar un país es una entrada en `lib/exams.js`.**

## Stack

| Capa | Elección |
|---|---|
| App | Next.js 14 (App Router, JS) |
| Hosting | Vercel (funciones serverless, techo de 60s) |
| IA | Gemini API vía `@google/genai` (AI Studio), multimodal |
| Modelo | `gemini-3.6-flash` + cadena de respaldo de 4 modelos |
| Evidencia | API de GitHub → rama `logs` (JSONL por run) |
| Analítica | Vercel Web Analytics |
| Pago | Mercado Pago, links de monto fijo |
| Entrega | WhatsApp + vista imprimible a PDF |

## Estructura

```
app/
  page.js                  raíz, detecta país
  [examen]/page.js         /paes /icfes /exani /peru
  ui.js                    flujo del estudiante + vista de entrega (?pack=1)
  p/[producto]/            los 4 negocios hermanos sobre el mismo motor
  api/diagnostico/route.js pipeline principal + candado + presupuesto de tiempo
  api/verdicto/route.js    pipeline de los productos hermanos
  api/health/route.js      sonda del pipeline completo
lib/
  exams.js                 registro de países (agregar país = agregar entrada)
  products.js              registro de los 4 negocios hermanos
  gemini.js                generación, parser tolerante, guardas de completitud
  qa.js                    agente de QA contra temario
  oplog.js                 log de evidencia a la rama logs
state-dump.sh              estado desplegado en un comando (solo curl + grep)
```

## Mercado objetivo

La cohorte PAES son unos **300.000 estudiantes al año** en Chile, más ICFES en Colombia,
EXANI en México y admisión en Perú. La línea de presupuesto ya existe y ya está asignada: es
la cuota del preuniversitario que la familia está decidiendo si puede pagar. No pedimos plata
nueva — somos lo primero que pueden comprar cuando la respuesta es que no.

Comprador secundario, mismo motor, cero código nuevo: el profesor jefe o la delegada de curso
que lo reenvía a treinta familias de una vez.

## Competencia

Cpech, Preuniversitario Pedro de Valdivia, Puntaje Nacional. Los tres venden contenido +
estructura + calendario como un paquete anual. **Cómo nos adoptan en vez de competir:** el
diagnóstico es una API. Un preu que ya tiene los resultados de ensayo de sus alumnos puede
llamarla y entregarle a cada uno una ruta por eje que sus tutores no alcanzan a escribir a
mano. No necesitamos que pierdan para que esto funcione.

## Dev

```bash
cp .env.example .env.local   # completar GEMINI_API_KEY
npm install
npm run dev
```

Variables: `GEMINI_API_KEY` · `GEMINI_MODEL` (opcional) · `GITHUB_PAT` (oplog) ·
`NEXT_PUBLIC_WSP_NUMBER` (WhatsApp) · `PACK_KEY` (candado del pack).
Ninguna clave va nunca al repo ni al chat: solo al store de secretos de la plataforma.

## Contexto de hackathon

Entrada a **Build with Gemini XPRIZE** (xprize.devpost.com) · Categoría **Education & Human
Potential** · Empezada dentro de ventana el 2026-07-30.

Operación AI-native, división de trabajo real y auditable: el humano es dueño del criterio,
las cuentas, las credenciales, el gusto y el botón de enviar. La fuerza de trabajo de IA es
dueña de la investigación, el código, los prompts, el QA, el monitoreo y el log de incidentes.
La rama `logs` es el recibo.
