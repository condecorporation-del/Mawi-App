import Link from "next/link";

/** Esquina inferior izquierda (tras sidebar ~5rem) para no competir con el FAB del agente a la derecha. */
export function ProjectsFab() {
  return (
    <div className="fixed bottom-8 left-24 z-[70] md:left-28">
      <Link
        aria-label="Nuevo proyecto"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-mawi-cyan text-mawi-cyan-on shadow-[0_0_25px_rgba(0,245,255,0.6)] transition-all hover:scale-110 active:scale-90"
        href="/projects/new"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </Link>
    </div>
  );
}
