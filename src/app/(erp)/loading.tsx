// Estado de carga al navegar entre páginas: el menú se queda fijo y el contenido
// muestra esto mientras se lee la sesión y los datos (navegación instantánea).
export default function Cargando() {
  return (
    <div className="py-16 text-center text-sm text-tinta-2" role="status">
      Cargando…
    </div>
  );
}
