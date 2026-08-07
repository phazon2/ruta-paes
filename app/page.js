import { headers } from "next/headers";
import Ui from "./ui";
import { COUNTRY_TO_EXAM, DEFAULT_EXAM } from "../lib/exams";

export const dynamic = "force-dynamic";

export default function Home({ searchParams }) {
  // 1) ?examen=icfes manda (lo usan los links de cada cuenta de TikTok/IG)
  // 2) si no, se detecta por país con el header geo de Vercel
  const q = searchParams?.examen;
  const pais = headers().get("x-vercel-ip-country");
  const def = q || COUNTRY_TO_EXAM[pais] || DEFAULT_EXAM;
  return <Ui defaultExam={def} />;
}
