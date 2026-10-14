"use client";

import { useSyncExternalStore } from "react";

import { themeCookie } from "../theme";

import { Icon, type IconName } from "./icons";

type Theme = "sistema" | "claro" | "oscuro";

const options: { value: Theme; label: string; icon: IconName }[] = [
  { value: "sistema", label: "Tema del sistema", icon: "monitor" },
  { value: "claro", label: "Tema claro", icon: "sun" },
  { value: "oscuro", label: "Tema oscuro", icon: "moon" },
];

const listeners = new Set<() => void>();

function current(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" ? "oscuro" : theme === "light" ? "claro" : "sistema";
}

/**
 * A device preference (cookie, one year), not account data. "Sistema"
 * removes it and follows the operating system again.
 */
function choose(theme: Theme) {
  const root = document.documentElement;
  if (theme === "sistema") {
    delete root.dataset.theme;
    document.cookie = `${themeCookie}=; Path=/; Max-Age=0; SameSite=Lax`;
  } else {
    root.dataset.theme = theme === "oscuro" ? "dark" : "light";
    document.cookie = `${themeCookie}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  listeners.forEach((listener) => listener());
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    current,
    () => null,
  );

  return (
    <div aria-label="Tema" className="theme-switcher" role="group">
      {options.map((option) => (
        <button
          aria-pressed={theme === option.value}
          className="theme-option"
          key={option.value}
          onClick={() => choose(option.value)}
          title={option.label}
          type="button"
        >
          <Icon name={option.icon} size={16} />
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
