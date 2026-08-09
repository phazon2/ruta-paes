import { notFound } from "next/navigation";
import ProductoUi from "./ui";
import { PRODUCTS, getProduct } from "../../../lib/products";

export function generateStaticParams() {
  return Object.keys(PRODUCTS).map((producto) => ({ producto }));
}

export function generateMetadata({ params }) {
  const p = getProduct(params.producto);
  if (!p) return {};
  return { title: `${p.nombre} — ${p.tagline}`, description: p.subtitulo };
}

export default function ProductoPage({ params }) {
  const p = getProduct(params.producto);
  if (!p) notFound();
  // solo datos serializables al cliente
  const safe = {
    id: p.id,
    nombre: p.nombre,
    tagline: p.tagline,
    subtitulo: p.subtitulo,
    inputLabel: p.inputLabel,
    inputAlt: p.inputAlt,
    altPlaceholder: p.altPlaceholder,
    precio: p.precio,
    privacidad: p.privacidad,
  };
  return <ProductoUi p={safe} />;
}
