"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { Icon } from "@/app/components/icons";
import { SlideOver } from "@/app/components/motion";

import { ConsultForm } from "./consult-form";
import { useAssistant } from "./session";

/** Same breakpoint as the side panel styles (.assistant-panel). */
const wideQuery = "(min-width: 64rem)";

function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(wideQuery);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(wideQuery).matches,
    () => true,
  );
}

/**
 * Floating "Preguntar" button and the panel it opens: a side panel next to
 * the content on wide screens (the page stays usable) and a modal sheet on
 * small ones. It never opens by itself; opening or closing sends nothing.
 */
export function AssistantDock() {
  const assistant = useAssistant();
  const { spaceId, open, scope, step, openPanel, closePanel, setScope } =
    assistant;
  const pathname = usePathname();
  const wide = useWide();
  const panelRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(false);
  const onAssistantPage = pathname === `/spaces/${spaceId}/assistant`;
  const shown = open && !onAssistantPage;

  // The Asistente page already shows the same session: no second form.
  useEffect(() => {
    if (onAssistantPage && open) closePanel();
  }, [onAssistantPage, open, closePanel]);

  // Tell the frame, so the content makes room for the panel or the button.
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".shell");
    if (!shell) return;
    shell.dataset.assistant = onAssistantPage
      ? "page"
      : shown
        ? wide
          ? "panel"
          : "sheet"
        : "button";
    return () => {
      delete shell.dataset.assistant;
    };
  }, [onAssistantPage, shown, wide]);

  // On small screens the sheet is modal: the rest of the page is inert.
  useEffect(() => {
    if (!shown || wide) return;
    const others = document.querySelectorAll<HTMLElement>(
      ".shell > .topbar, .shell > .sidebar, .shell > .app-content",
    );
    others.forEach((element) => element.setAttribute("inert", ""));
    return () => others.forEach((element) => element.removeAttribute("inert"));
  }, [shown, wide]);

  // Focus the question when the panel opens.
  useEffect(() => {
    if (!shown) return;
    const frame = requestAnimationFrame(() =>
      panelRef.current
        ?.querySelector<HTMLElement>("textarea")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [shown, scope]);

  // On phones the button hides while the keyboard is up for another field.
  useEffect(() => {
    if (wide) return;
    const update = () => {
      const active = document.activeElement;
      setTyping(
        Boolean(active?.matches("input, textarea, select, [contenteditable]")),
      );
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [wide]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePanel();
    }
  };

  if (onAssistantPage) return null;

  return (
    <>
      {!shown && !(typing && !wide) ? (
        <button
          className="assistant-fab"
          onClick={(event) => openPanel("espacio", event.currentTarget)}
          type="button"
        >
          <Icon name="assistant" size={20} />
          Preguntar
        </button>
      ) : null}

      {shown && !wide ? (
        <div
          aria-hidden="true"
          className="assistant-backdrop"
          onClick={closePanel}
        />
      ) : null}

      <SlideOver
        className={`assistant-panel ${wide ? "is-side" : "is-sheet"}`}
        from={wide ? "right" : "bottom"}
        open={shown}
      >
        <div
          aria-labelledby="assistant-panel-title"
          aria-modal={wide ? undefined : true}
          className="assistant-panel-inner"
          onKeyDown={onKeyDown}
          ref={panelRef}
          role="dialog"
        >
          <header className="assistant-panel-header">
            <div>
              <h2 id="assistant-panel-title">
                {scope === "paso"
                  ? "Ayuda de este paso"
                  : "Preguntar al asistente"}
              </h2>
              <p className="muted">
                {scope === "paso" && step
                  ? `Paso ${step.position}: ${step.title}`
                  : "Consulta sobre las fuentes del espacio. Cada pregunta es independiente."}
              </p>
            </div>
            <button className="icon-button" onClick={closePanel} type="button">
              <Icon name="close" />
              <span className="sr-only">Cerrar asistente</span>
            </button>
          </header>

          {step ? (
            <div
              aria-label="Sobre qué preguntar"
              className="scope-switch"
              role="group"
            >
              <button
                aria-pressed={scope === "espacio"}
                className="scope-option"
                onClick={() => setScope("espacio")}
                type="button"
              >
                El espacio
              </button>
              <button
                aria-pressed={scope === "paso"}
                className="scope-option"
                onClick={() => setScope("paso")}
                type="button"
              >
                Este paso
              </button>
            </div>
          ) : null}

          <div className="assistant-panel-body">
            <ConsultForm key={scope} scope={scope} variant="panel" />
          </div>

          {scope === "espacio" ? (
            <footer className="assistant-panel-footer">
              <Link href={`/spaces/${spaceId}/assistant`}>
                Abrir en la página Asistente
              </Link>
            </footer>
          ) : null}
        </div>
      </SlideOver>
    </>
  );
}
