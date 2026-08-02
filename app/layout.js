import "./globals.css";

export const metadata = {
  title: "Ruta PAES — tu ensayo se convierte en tu plan",
  description:
    "Tu último ensayo se convierte en tu plan: diagnóstico con IA, ruta de estudio y ejercicios dirigidos — por el precio de un completo.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
