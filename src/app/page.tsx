import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Acceso local E1.6</p>
      <h1>Stepable</h1>
      <p>
        La base local permite probar identidad, sesión, invitaciones y el ciclo
        de membresías por espacio.
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
