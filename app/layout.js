import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "Ruta PAES · ICFES · EXANI — tu ensayo se convierte en tu plan",
  description:
    "Sube el informe de tu último ensayo o simulacro (PAES Chile, ICFES Colombia, EXANI México, admisión Perú): diagnóstico con IA, ruta de estudio de 14 días y ejercicios dirigidos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-CL">
      <body>
        {children}
        {/* Conteo de visitantes para la evidencia del concurso. Sin cookies y
            sin datos personales: no reemplaza captura de correo, y no la queremos. */}
        <Analytics />
      </body>
    </html>
  );
}
