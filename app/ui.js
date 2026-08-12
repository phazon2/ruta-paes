"use client";

import { useEffect, useState } from "react";
import { EXAMS, getExam, semanasRestantes } from "../lib/exams";

// El orden es: WhatsApp primero, pago despues. Mercado Pago no devuelve al
// comprador a nuestro sitio, asi que cualquier instruccion posterior al pago
// queda en una pantalla que ya no ve: pagaba y desaparecia sin dejar contacto.
// Con entrega manual no se le cobra a alguien a quien no podemos escribir.
//
// Fallback: si NEXT_PUBLIC_WSP_NUMBER no esta configurado no hay a donde
// escribir, y entonces (y solo entonces) se muestra el link de pago directo.
const MP_LINK = "https://mpago.li/1ACDfPj";
const WSP = process.env.NEXT_PUBLIC_WSP_NUMBER || "";

export default function Ui({ defaultExam = "paes" }) {
  // Vista de entrega (?pack=1): muestra el resultado completo, sin borrosos ni
  // paywall, listo para imprimir a PDF y mandar por WhatsApp. La usa Diego,
  // no el estudiante. Se lee en un efecto para no romper la hidratacion.
  const [packMode, setPackMode] = useState(false);
  const [packKey, setPackKey] = useState("");
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setPackMode(sp.get("pack") === "1");
    setPackKey(sp.get("key") || "");
  }, []);

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
    if (packKey) payload.packKey = packKey;

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
      <div className="paises no-print">
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

      <h1 className="no-print">
        Tu último {exam.ensayo} se convierte en <span className="accent">tu plan</span>
      </h1>
      <p className="pitch no-print">
        Diagnóstico con IA, ruta de estudio de 14 días y ejercicios dirigidos — por{" "}
        {exam.ancla}.
      </p>
      <p className="urgencia no-print">
        Quedan {semanasRestantes(exam)} semanas para el {exam.nombre} de {exam.pais} ·
        Sube el informe de tu último {exam.ensayo} y sabe qué atacar primero.
      </p>

      {packMode && result && (
        <>
          <div className="pack-header">
            <h1>
              Tu Ruta {exam.nombre} — plan de {result.dias || 14} días
            </h1>
            <p>
              {exam.nombreLargo} · {exam.organismo} · {exam.fechaTexto} ·{" "}
              {result.prueba || ""}
            </p>
          </div>
          {result.full === false && (
            <div className="error no-print">
              <strong>Esto es la muestra, no el pack.</strong>{" "}
              {result.packKeyConfigurada
                ? "La clave del link no es válida: revisa el parámetro key."
                : "Falta configurar PACK_KEY en Vercel; sin esa variable el servidor no entrega el pack completo a nadie."}
            </div>
          )}
          {result.full && result.entregable === false && (
            <div className="error no-print">
              <strong>Pack incompleto — no lo mandes así.</strong> El modelo
              devolvió {result.dias} de 14 días y {result.totalDrills} de 4
              ejercicios, incluso después del reintento. Vuelve a generarlo.
            </div>
          )}
          {result.full && result.entregable && result.completo === false && (
            <div className="aviso no-print">
              <strong>Le faltan {14 - result.dias} día(s) a la ruta.</strong> Los{" "}
              {result.totalDrills} ejercicios están completos, así que se puede
              mandar igual. Si prefieres los 14 exactos, vuelve a generarlo.
            </div>
          )}
        </>
      )}

      {!result && (
        <form className="card no-print" onSubmit={onSubmit}>
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
            <h2 style={{ marginTop: 0 }}>Ejercicios dirigidos a tus ejes débiles</h2>
            {(packMode ? result.drills || [] : (result.drills || []).slice(0, 1)).map((d, i) => (
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
                {/* En el pack la solucion va abierta: un <details> cerrado se
                    imprime vacio y el PDF llegaria sin las soluciones. */}
                {packMode ? (
                  <p className="solucion">
                    <strong>Correcta: {d.correcta}.</strong> {d.solucion}
                  </p>
                ) : (
                  <details>
                    <summary>Ver solución</summary>
                    <p>
                      <strong>Correcta: {d.correcta}.</strong> {d.solucion}
                    </p>
                  </details>
                )}
              </div>
            ))}
            {!packMode && (result.drills || []).length > 1 && (
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

            {!packMode && (
            <div className="paywall">
              <div className="precio">{exam.precioTexto}</div>
              <div className="nota">
                Desbloquea tu ruta completa de 14 días + pack de ejercicios por cada eje
                débil, con soluciones paso a paso. Entrega por WhatsApp.
                <br />
                {WSP ? (
                  <strong>Escríbeme por WhatsApp y te paso el link de pago.</strong>
                ) : (
                  <>
                    <strong>
                      {exam.mpLink
                        ? `El link ya viene con el monto: ${exam.precioTexto}.`
                        : `En Mercado Pago ingresa el monto: ${exam.precio}.`}
                    </strong>{" "}
                    Luego manda tu comprobante por WhatsApp y recibe tu pack.
                  </>
                )}
              </div>
              {WSP ? (
                <a
                  className="btn"
                  href={`https://wa.me/${WSP}?text=${encodeURIComponent(
                    `Hola! Quiero mi Ruta ${exam.nombre} completa.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escríbeme y te paso el link de pago
                </a>
              ) : (
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
              )}
            </div>
            )}
          </div>

          {packMode && (
            <>
              <p className="pack-pie">
                Preparado para ti por Ruta {exam.nombre}. Los ejercicios son
                originales y siguen el temario oficial de {exam.organismo}. Si algo
                no te calza con tu informe, escríbeme y lo corrijo.
              </p>
              <button className="btn no-print" onClick={() => window.print()}>
                Imprimir / Guardar como PDF
              </button>
            </>
          )}

          <button className="btn secondary no-print" onClick={() => setResult(null)}>
            Hacer otro diagnóstico
          </button>
        </>
      )}

      <footer className="no-print">
        Ruta PAES · ejercicios originales alineados al {`temario oficial de ${exam.organismo}`} · operado por
        agentes de IA · v1.0 multipaís
      </footer>
    </main>
  );
}
