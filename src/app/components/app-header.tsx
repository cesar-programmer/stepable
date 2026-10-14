import Link from "next/link";

import { logoutAction } from "@/app/auth/actions";

import { Icon, Logo } from "./icons";
import { SubmitButton } from "./submit-button";
import { ThemeSwitcher } from "./theme-switcher";

/** Header for signed-in pages outside a space. */
export function AppHeader({ email }: { email: string }) {
  return (
    <header className="app-header">
      <Link className="app-brand" href="/spaces">
        <Logo />
        <span>Stepable</span>
      </Link>
      <div className="app-header-user">
        <p className="muted">{email}</p>
        <ThemeSwitcher />
        <form action={logoutAction}>
          <SubmitButton className="secondary small" pendingLabel="Saliendo…">
            <Icon name="logout" size={18} />
            Cerrar sesión
          </SubmitButton>
        </form>
      </div>
    </header>
  );
}
