"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { logoutAction } from "@/app/auth/actions";

import { AssistantDock } from "./assistant/dock";
import { AssistantProvider } from "./assistant/session";
import { Icon, Logo, type IconName } from "./icons";
import { LinkPending } from "./motion";
import { ThemeSwitcher } from "./theme-switcher";
import { SubmitButton } from "./submit-button";

export type ShellSpace = {
  id: string;
  name: string;
  role: "responsable" | "integrante";
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  group: "principal" | "administracion" | "cuenta";
  exact?: boolean;
};

const roleLabels: Record<ShellSpace["role"], string> = {
  responsable: "Responsable",
  integrante: "Integrante",
};

const groupLabels: Record<NavItem["group"], string | null> = {
  principal: null,
  administracion: "Administración",
  cuenta: "Cuenta",
};

/**
 * Application frame for a space: sidebar on wide screens, drawer on small
 * ones. The items come from the server, already filtered by role; every
 * page still authorizes on its own.
 */
export function SpaceShell({
  space,
  spaces,
  email,
  nav,
  children,
}: {
  space: ShellSpace;
  spaces: ShellSpace[];
  email: string | null;
  nav: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  // The drawer belongs to the page where it was opened: navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean) => setOpenAt(value ? pathname : null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    navRef.current?.querySelector<HTMLElement>("a, summary")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const groups = (["principal", "administracion", "cuenta"] as const)
    .map((group) => ({
      group,
      items: nav.filter((item) => item.group === group),
    }))
    .filter((entry) => entry.items.length > 0);
  const otherSpaces = spaces.filter((item) => item.id !== space.id);

  // The floating assistant only where the role can consult the sources.
  const assistantEnabled = nav.some((item) => item.href.endsWith("/assistant"));

  return (
    // Keyed by space: another space starts with an empty assistant session.
    <AssistantProvider key={space.id} spaceId={space.id}>
      <div className="shell" data-open={open || undefined}>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <header className="topbar">
          <Link className="app-brand" href="/spaces">
            <Logo size={26} />
            <span>Stepable</span>
          </Link>
          <span className="topbar-space">{space.name}</span>
          <button
            aria-controls="menu-espacio"
            aria-expanded={open}
            className="icon-button"
            onClick={() => setOpen(!open)}
            type="button"
          >
            <Icon name={open ? "close" : "menu"} />
            <span className="sr-only">
              {open ? "Cerrar menú" : "Abrir menú"}
            </span>
          </button>
        </header>

        <aside className="sidebar" id="menu-espacio" ref={navRef}>
          <Link className="app-brand sidebar-brand" href="/spaces">
            <Logo />
            <span>Stepable</span>
          </Link>

          <details className="switcher" key={pathname}>
            <summary>
              <span className="avatar" aria-hidden="true">
                {space.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="switcher-text">
                <span className="switcher-label">Espacio actual</span>
                <span className="switcher-name">{space.name}</span>
              </span>
              <Icon className="switcher-chevron" name="chevronDown" size={18} />
            </summary>
            <div className="switcher-menu">
              <p className="switcher-role">
                Tu rol: <strong>{roleLabels[space.role]}</strong>
              </p>
              {otherSpaces.length > 0 ? (
                <ul>
                  {otherSpaces.map((item) => (
                    <li key={item.id}>
                      <Link href={`/spaces/${item.id}`}>
                        <span className="avatar small" aria-hidden="true">
                          {item.name.slice(0, 1).toUpperCase()}
                        </span>
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link className="switcher-all" href="/spaces">
                <Icon name="swap" size={16} />
                Todos tus espacios
              </Link>
            </div>
          </details>

          <nav aria-label="Espacio" className="side-nav">
            {groups.map(({ group, items }) => (
              <div className="nav-group" key={group}>
                {groupLabels[group] ? (
                  <p className="nav-group-label">{groupLabels[group]}</p>
                ) : null}
                <ul>
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        aria-current={isActive(item) ? "page" : undefined}
                        className="nav-link"
                        href={item.href}
                      >
                        <Icon name={item.icon} />
                        {item.label}
                        <LinkPending />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            {email ? <p className="sidebar-email">{email}</p> : null}
            <div className="sidebar-footer-row">
              <ThemeSwitcher />
              <form action={logoutAction}>
                <SubmitButton className="ghost small" pendingLabel="Saliendo…">
                  <Icon name="logout" size={18} />
                  Cerrar sesión
                </SubmitButton>
              </form>
            </div>
          </div>
        </aside>

        <div
          aria-hidden="true"
          className="backdrop"
          onClick={() => setOpen(false)}
        />
        <div className="app-content" id="contenido" tabIndex={-1}>
          {children}
        </div>
        {assistantEnabled ? <AssistantDock /> : null}
      </div>
    </AssistantProvider>
  );
}
