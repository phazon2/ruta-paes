"use client";

import { useState } from "react";

// Fallback de monto abierto: solo para los productos que todavia no tienen link
// de monto fijo propio (ver mpLink en lib/products.js).
const MP_LINK = "https://mpago.li/1ACDfPj";

export default function ProductoUi({ p }) {
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
      <h1>{p.tagline}</h1>
      <p className="pitch">{p.subtitulo}</p>
      <p className="urgencia">{p.privacidad}</p>

      {!result && (
        <form className="card" onSubmit={onSubmit}>
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
            {(result.ruta || []).slice(0, 5).map((r) => (
              <div className="dia" key={r.dia}>
                <div className="n">DÍA {r.dia}</div>
                <div className="foco">{r.foco}</div>
                <div>{r.tarea}</div>
                <div className="porque">{r.porque}</div>
              </div>
            ))}
            {(result.ruta || []).length > 5 && (
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
            {(result.drills || []).slice(0, 1).map((d, i) => (
              <div className="drill" key={i}>
                <div style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 700 }}>{d.eje}</div>
                <div className="enunciado">{d.enunciado}</div>
                <ol>
                  {(d.alternativas || []).map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ol>
                <details>
                  <summary>Ver recomendación</summary>
                  <p>
                    <strong>{d.correcta}.</strong> {d.solucion}
                  </p>
                </details>
              </div>
            ))}

            <div className="paywall">
              <div className="precio">{p.precio}</div>
              <div className="nota">
                Desbloquea el plan completo de 14 días y todos los textos listos para usar.
                <br />
                <strong>
                  {p.mpLink
                    ? `El link ya viene con el monto: ${p.precio}.`
                    : `En Mercado Pago ingresa el monto: ${p.precio}.`}
                </strong>
              </div>
              <a
                className="btn"
                href={p.mpLink || MP_LINK}
                target="_blank"
                rel="noopener noreferrer"
              >
                Desbloquear todo
              </a>
            </div>
          </div>

          <button className="btn secondary" onClick={() => setResult(null)}>
            Hacer otro análisis
          </button>
        </>
      )}

      <footer>
        {p.nombre} · operado por agentes de IA · cada resultado revisado por un agente de QA
      </footer>
    </main>
  );
}
