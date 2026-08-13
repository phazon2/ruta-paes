"use client";

import { useEffect, useState } from "react";

// Mismo orden que en la home: WhatsApp primero, pago despues. Ver el comentario
// largo en app/ui.js. Fallback al link de pago solo si no hay numero configurado.
const MP_LINK = "https://mpago.li/1ACDfPj";
const WSP = process.env.NEXT_PUBLIC_WSP_NUMBER || "";

export default function ProductoUi({ p }) {
  // Vista de entrega (?pack=1&key=...): igual que en Ruta PAES. La usa Diego
  // despues del pago, no el cliente. El recorte real ocurre en el servidor.
  const [packMode, setPackMode] = useState(false);
  const [packKey, setPackKey] = useState("");
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setPackMode(sp.get("pack") === "1");
    setPackKey(sp.get("key") || "");
  }, []);

  const [mode, setMode] = useState("archivo");
  const [file, setFile] = useState(null);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    let payload = { productId: p.id };
    if (mode === "archivo") {
      if (!file) return setError("Sube el documento o cambia a escribir tu situación.");
      if (file.size > 8 * 1024 * 1024) return setError("El archivo supera los 8 MB.");
      const fileBase64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      payload = { ...payload, fileBase64, mimeType: file.type };
    } else {
      if (texto.trim().length < 15) return setError("Cuéntame un poco más para poder ayudarte.");
      payload = { ...payload, texto };
    }
    if (packKey) payload.packKey = packKey;

    setLoading(true);
    try {
      const res = await fetch("/api/verdicto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.error || "Error") + (data.detalle ? ` [${data.detalle}]` : ""));
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1 className="no-print">{p.tagline}</h1>
      <p className="pitch no-print">{p.subtitulo}</p>
      <p className="urgencia no-print">{p.privacidad}</p>

      {packMode && result && (
        <>
          <div className="pack-header">
            <h1>{p.nombre} — tu plan de {result.pasos || 14} días</h1>
            <p>{p.categoria} · preparado a partir de tu propio documento</p>
          </div>
          {result.full === false && (
            <div className="error no-print">
              <strong>Esto es la muestra, no el pack.</strong>{" "}
              {result.packKeyConfigurada
                ? "La clave del link no es válida: revisa el parámetro key."
                : "Falta configurar PACK_KEY en Vercel."}
            </div>
          )}
          {result.full && (result.ingles || []).length > 0 && (
            <div className="aviso no-print">
              <strong>Hay texto en inglés en el pack.</strong> Se detectó:{" "}
              {result.ingles.join(", ")}. Vuelve a generarlo antes de mandarlo.
            </div>
          )}
          {result.full && result.completo === false && (
            <div className="error no-print">
              <strong>Pack incompleto — no lo mandes así.</strong> Volvieron{" "}
              {result.pasos} de 14 pasos y {result.totalDrills} de 2 artefactos.
              Vuelve a generarlo.
            </div>
          )}
        </>
      )}

      {!result && (
        <form className="card no-print" onSubmit={onSubmit}>
          <div className="tabs">
            <button type="button" className={mode === "archivo" ? "active" : ""} onClick={() => setMode("archivo")}>
              Subir documento
            </button>
            <button type="button" className={mode === "texto" ? "active" : ""} onClick={() => setMode("texto")}>
              Escribirlo
            </button>
          </div>

          {mode === "archivo" ? (
            <>
              <label>{p.inputLabel}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </>
          ) : (
            <>
              <label>{p.inputAlt}</label>
              <textarea placeholder={p.altPlaceholder} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </>
          )}

          <button className="btn" disabled={loading}>
            {loading ? "Analizando…" : "Ver mi resultado gratis"}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
      )}

      {loading && <div className="loading">La IA está leyendo y armando tu plan… (~30 segundos)</div>}

      {result && (
        <>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Tu diagnóstico</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>{result.resumen}</p>
            <div style={{ marginTop: 12 }}>
              {(result.diagnostico || []).map((d, i) => (
                <div className="diag-item" key={i}>
                  <div>
                    <div className="eje">{d.eje}</div>
                    <div className="evidencia">{d.evidencia}</div>
                  </div>
                  <span className={`nivel ${d.nivel}`}>{d.nivel}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Tu plan de 14 días</h2>
            {(packMode ? result.ruta || [] : (result.ruta || []).slice(0, 5)).map((r) => (
              <div className="dia" key={r.dia}>
                <div className="n">DÍA {r.dia}</div>
                <div className="foco">{r.foco}</div>
                <div>{r.tarea}</div>
                <div className="porque">{r.porque}</div>
              </div>
            ))}
            {!packMode && (result.ruta || []).length > 5 && (
              <div className="locked">
                {(result.ruta || []).slice(5, 8).map((r) => (
                  <div className="dia" key={r.dia}>
                    <div className="n">DÍA {r.dia}</div>
                    <div className="foco">{r.foco}</div>
                    <div>{r.tarea}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Lo que te queda listo</h2>
            {(packMode ? result.drills || [] : (result.drills || []).slice(0, 1)).map((d, i) => (
              <div className="drill" key={i}>
                <div style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 700 }}>{d.eje}</div>
                <div className="enunciado">{d.enunciado}</div>
                <ol>
                  {(d.alternativas || []).map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ol>
                {/* En el pack la recomendacion va abierta: un <details> cerrado
                    se imprime vacio y el PDF saldria sin lo que se cobra. */}
                {packMode ? (
                  <p className="solucion">
                    <strong>{d.correcta}.</strong> {d.solucion}
                  </p>
                ) : (
                  <details>
                    <summary>Ver recomendación</summary>
                    <p>
                      <strong>{d.correcta}.</strong> {d.solucion}
                    </p>
                  </details>
                )}
              </div>
            ))}

            {!packMode && (
            <div className="paywall">
              <div className="precio">{p.precio}</div>
              <div className="nota">
                Desbloquea el plan completo de 14 días y todos los textos listos para usar.
                <br />
                {WSP ? (
                  <strong>Escríbeme por WhatsApp y te paso el link de pago.</strong>
                ) : (
                  <>
                    <strong>
                      {p.mpLink
                        ? `El link ya viene con el monto: ${p.precio}.`
                        : `En Mercado Pago ingresa el monto: ${p.precio}.`}
                    </strong>{" "}
                    Luego manda tu comprobante por WhatsApp y recibe tu pack.
                  </>
                )}
              </div>
              {WSP ? (
                <a
                  className="btn"
                  href={`https://wa.me/${WSP}?text=${encodeURIComponent(
                    `Hola! Quiero mi pack de ${p.nombre}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escríbeme y te paso el link de pago
                </a>
              ) : (
                <a
                  className="btn"
                  href={p.mpLink || MP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Desbloquear todo
                </a>
              )}
            </div>
            )}
          </div>

          {packMode && (
            <>
              <p className="pack-pie">
                Preparado para ti por {p.nombre}. Si algo no te calza con tu
                documento, escríbeme y lo corrijo.
              </p>
              <button className="btn no-print" onClick={() => window.print()}>
                Imprimir / Guardar como PDF
              </button>
            </>
          )}

          <button className="btn secondary no-print" onClick={() => setResult(null)}>
            Hacer otro análisis
          </button>
        </>
      )}

      <footer className="no-print">
        {p.nombre} · operado por agentes de IA · cada resultado revisado por un agente de QA
      </footer>
    </main>
  );
}
