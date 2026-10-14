import Link from "next/link";
import type { ReactNode } from "react";

import { Icon, Logo, type IconName } from "./icons";
import { ThemeSwitcher } from "./theme-switcher";

const highlights: { icon: IconName; text: string }[] = [
  {
    icon: "route",
    text: "Rutas de onboarding que la IA redacta y tu equipo revisa antes de publicar.",
  },
  {
    icon: "book",
    text: "Práctica con opción múltiple, lectura de código y código para completar.",
  },
  {
    icon: "assistant",
    text: "Un asistente que responde citando la documentación del equipo.",
  },
];

/**
 * Frame for signed-out pages: brand panel and a focused form column on wide
 * screens, stacked on small ones.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <Link className="app-brand auth-logo" href="/">
          <Logo size={32} />
          <span>Stepable</span>
        </Link>
        <div className="auth-brand-body">
          <p className="auth-brand-title">
            El onboarding de tu equipo, a partir de su propia documentación.
          </p>
          <ul className="auth-highlights">
            {highlights.map((item) => (
              <li key={item.icon}>
                <span className="auth-highlight-icon">
                  <Icon name={item.icon} size={18} />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-theme">
          <ThemeSwitcher />
        </div>
        <div className="auth-panel">
          <h1>{title}</h1>
          {description ? <p className="muted">{description}</p> : null}
          {children}
        </div>
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </main>
    </div>
  );
}

export function AuthMessage({
  tone,
  children,
}: {
  tone: "error" | "notice" | "callout";
  children: ReactNode;
}) {
  return (
    <p className={tone} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "error" ? "alert" : "check"} size={18} />
      <span>{children}</span>
    </p>
  );
}
