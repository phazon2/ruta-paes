import Ui from "../ui";
import { EXAMS, getExam } from "../../lib/exams";

export function generateStaticParams() {
  return Object.keys(EXAMS).map((examen) => ({ examen }));
}

export function generateMetadata({ params }) {
  const e = getExam(params.examen);
  return {
    title: `Ruta ${e.nombre} — tu ${e.ensayo} se convierte en tu plan`,
    description: `Diagnóstico con IA de tu ${e.ensayo} ${e.nombre}, ruta de estudio de 14 días y ejercicios dirigidos — por ${e.precioTexto}, ${e.ancla}.`,
  };
}

export default function ExamPage({ params }) {
  if (!EXAMS[params.examen]) {
    return <Ui defaultExam="paes" />;
  }
  return <Ui defaultExam={params.examen} />;
}
