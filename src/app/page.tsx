import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Onboarding y consultas para equipos</p>
      <h1>Stepable</h1>
      <p>
        Convierte la documentación de tu equipo en rutas de aprendizaje
        revisadas, con preguntas, ejercicios de código y un asistente que
        responde citando las fuentes.
      </p>
      <div className="actions">
        <Link className="button" href="/login">
          Iniciar sesión
        </Link>
        <Link className="button secondary" href="/protected">
          Abrir página protegida
        </Link>
        <Link className="button secondary" href="/spaces">
          Ver mis espacios
        </Link>
      </div>
    </main>
  );
}
