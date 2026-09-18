import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Identidad local E1.2</p>
      <h1>Stepable</h1>
      <p>
        La base local permite probar identidad y sesión sin registro público.
      </p>
      <div className="actions">
        <Link className="button" href="/login">
          Iniciar sesión
        </Link>
        <Link className="button secondary" href="/protected">
          Abrir página protegida
        </Link>
      </div>
    </main>
  );
}
