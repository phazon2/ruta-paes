"use client";

import { useState } from "react";
import { EXAMS, getExam, semanasRestantes } from "../lib/exams";

// Fallback de monto abierto: solo para los examenes que todavia no tienen link
// de monto fijo propio (ver mpLink en lib/exams.js).
const MP_LINK = "https://mpago.li/1ACDfPj";
const WSP = process.env.NEXT_PUBLIC_WSP_NUMBER || "";

export default function Ui({ defaultExam = "paes" }) {
  const [examId, setExamId] = useState(defaultExam);
  const exam = getExam(examId);
  const [mode, setMode] = useState("archivo");
  const [file, setFile] = useState(null);
  const [prueba, setPrueba] = useState(getExam(defaultExam).pruebas[0]);
  const [puntaje, setPuntaje] = useState("");
  const [detalle, setDetalle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    let payload = {};
    if (mode === "archivo") {
      if (!file) {
        setError("Sube una foto o PDF de tu informe.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("El archivo supera los 8 MB. Prueba con una foto más liviana.");
        return;
      }
      const fileBase64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      payload = { fileBase64, mimeType: file.type, examId };
    } else {
      if (!puntaje) {
        setError("Escribe tu puntaje.");
        return;
      }
      payload = { scores: { prueba, puntaje, detalle }, examId };
    }

    setLoading(true);
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          (data.error || "Error generando el diagnóstico") +
            (data.detalle ? ` [${data.detalle}]` : "")
        );
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="paises">
        {Object.values(EXAMS).map((e) => (
          <button
            key={e.id}
            type="button"
            className={e.id === examId ? "pais activo" : "pais"}
            onClick={() => {
              setExamId(e.id);
              setPrueba(e.pruebas[0]);
              setResult(null);
              setError("");
            }}
          >
            {e.bandera} {e.nombre}
          </button>
        ))}
      </div>

      <h1>
        Tu último {exam.ensayo} se convierte en <span className="accent">tu plan</span>
      </h1>
      <p className="pitch">
        Diagnóstico con IA, ruta de estudio de 14 días y ejercicios dirigidos — por{" "}
        {exam.ancla}.
      </p>
      <p className="urgencia">
        Quedan {semanasRestantes(exam)} semanas para el {exam.nombre} de {exam.pais} ·
        Sube el informe de tu último {exam.ensayo} y sabe qué atacar primero.
      </p>

      {!result && (
        <form className="card" onSubmit={onSubmit}>
          <div className="tabs">
            <button
              type="button"
              className={mode === "archivo" ? "active" : ""}
              onClick={() => setMode("archivo")}
            >
              📄 Subir mi informe
            </button>
            <button
              type="button"
              className={mode === "puntajes" ? "active" : ""}
              onClick={() => setMode("puntajes")}
            >
              ✏️ Escribir mis puntajes
            </button>
          </div>

          {mode === "archivo" ? (
            <>
              <label>{`Foto o PDF del informe de tu último ${exam.ensayo}`}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </>
          ) : (
            <>
              <label>Prueba</label>
              <select value={prueba} onChange={(e) => setPrueba(e.target.value)}>
                {exam.pruebas.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <label>{`Puntaje de tu ${exam.ensayo}`}</label>
              <input
                type="number"
                min="100"
                max="1000"
                placeholder="Ej: 640"
                value={puntaje}
                onChange={(e) => setPuntaje(e.target.value)}
              />
              <label>Detalle (opcional: aciertos por área, omitidas, lo que tengas)</label>
              <textarea
                placeholder="Ej: Álgebra 12/20, Geometría 5/15, omití 8 en probabilidad..."
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
              />
            </>
          )}

          <button className="btn" disabled={loading}>
            {loading ? "Analizando tu ensayo…" : "Generar mi diagnóstico gratis"}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
      )}

      {loading && (
        <div className="loading">
          La IA está leyendo tu ensayo y armando tu ruta… (~30 segundos)
        </div>
      )}

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
            <h2 style={{ marginTop: 0 }}>Tu ruta de 14 días</h2>
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
            <h2 style={{ marginTop: 0 }}>Ejercicios dirigidos a tus ejes débiles</h2>
            {(result.drills || []).slice(0, 1).map((d, i) => (
              <div className="drill" key={i}>
                <div className="n" style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 700 }}>
                  {d.eje}
                </div>
                <div className="enunciado">{d.enunciado}</div>
                <ol>
                  {(d.alternativas || []).map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                </ol>
                <details>
                  <summary>Ver solución</summary>
                  <p>
                    <strong>Correcta: {d.correcta}.</strong> {d.solucion}
                  </p>
                </details>
              </div>
            ))}
            {(result.drills || []).length > 1 && (
              <div className="locked">
                {(result.drills || []).slice(1, 2).map((d, i) => (
                  <div className="drill" key={i}>
                    <div className="enunciado">{d.enunciado}</div>
                    <ol>
                      {(d.alternativas || []).map((a, j) => (
                        <li key={j}>{a}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}

            <div className="paywall">
              <div className="precio">{exam.precioTexto}</div>
              <div className="nota">
                Desbloquea tu ruta completa de 14 días + pack de ejercicios por cada eje
                débil, con soluciones paso a paso. Entrega por WhatsApp.
                <br />
                <strong>
                  {exam.mpLink
                    ? `El link ya viene con el monto: ${exam.precioTexto}.`
                    : `En Mercado Pago ingresa el monto: ${exam.precio}.`}
                </strong>{" "}
                Luego manda tu comprobante y recibe tu pack.
              </div>
              <a
                className="btn"
                href={exam.mpLink || MP_LINK || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={
                  !(exam.mpLink || MP_LINK) ? { opacity: 0.55, pointerEvents: "none" } : {}
                }
              >
                {exam.mpLink || MP_LINK
                  ? "Desbloquear mi pack completo"
                  : "Pago disponible pronto"}
              </a>
              {WSP && (
                <a
                  className="btn secondary"
                  href={`https://wa.me/${WSP}?text=${encodeURIComponent("Hola! Pagué mi Ruta PAES, este es mi comprobante:")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ya pagué — enviar comprobante
                </a>
              )}
            </div>
          </div>

          <button className="btn secondary" onClick={() => setResult(null)}>
            Hacer otro diagnóstico
          </button>
        </>
      )}

      <footer>
        Ruta PAES · ejercicios originales alineados al {`temario oficial de ${exam.organismo}`} · operado por
        agentes de IA · v1.0 multipaís
      </footer>
    </main>
  );
}
