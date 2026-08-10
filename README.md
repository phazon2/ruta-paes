# Ruta PAES

**Tu último ensayo se convierte en tu plan: diagnóstico con IA, ruta de estudio y ejercicios dirigidos — por menos que una hora de profe particular.**

Entry for **Build with Gemini XPRIZE** (xprize.devpost.com) · Category: Education & Human Potential · Started in-window 2026-07-30.

## Qué hace

1. El estudiante sube la foto/PDF del informe de su último ensayo PAES (de cualquier preu) o escribe sus puntajes.
2. Gemini (multimodal) diagnostica el rendimiento por eje temático DEMRE.
3. Sale un artefacto: **ruta personal de 14 días + ejercicios originales estilo DEMRE** por eje débil, con soluciones en chileno.
4. Pago vía link de Mercado Pago (CLP $9.990) desbloquea el pack completo, entregado por WhatsApp.

## Stack

- Next.js 14 (App Router, JS) en Vercel
- Gemini API vía `@google/genai` (AI Studio) — modelo configurable con `GEMINI_MODEL`
- Mercado Pago Link de pago (sin backend de pagos en v0)

## Dev

```bash
cp .env.example .env.local   # completar GEMINI_API_KEY
npm install
npm run dev
```

## Deploy

Vercel + integración GitHub: push a `main` = deploy. Configurar en Vercel las env vars de `.env.example`.

## Estado (2026-08-02)

**LIVE: https://ruta-paes.vercel.app** — build limpio, landing verificada. E2E del flujo diagnóstico en curso. TODO próximos bloques: bump next 14.2.x (parche seguridad), QA agent (rubrica temario/formato), logging persistente de runs (evidencia agent-ops), Mercado Pago link real, soporte/status agent, P&L cron, SEO landing.

## AI-native operations

Fulfillment (parse → diagnóstico → drills → QA → entrega) corre con agentes; cada run se loggea (JSONL). Claude = COO · Gemini = production workforce · humano = judgment + accounts.
