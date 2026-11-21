import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-lg font-semibold text-tinta">No encontrado</h1>
      <p className="text-sm text-tinta-2">El documento o la página que buscas no existe.</p>
      <Link href="/" className="text-sm text-acento underline">Volver al inicio</Link>
    </div>
  );
}
