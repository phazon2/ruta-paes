import "./globals.css";

export const metadata = {
  title: "Ruta PAES · ICFES · EXANI — tu ensayo se convierte en tu plan",
  description:
    "Sube el informe de tu último ensayo o simulacro (PAES Chile, ICFES Colombia, EXANI México, admisión Perú): diagnóstico con IA, ruta de estudio de 14 días y ejercicios dirigidos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
