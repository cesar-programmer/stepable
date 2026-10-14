"use client";

import { useEffect } from "react";

import { useAssistant } from "@/app/components/assistant/session";
import { Icon } from "@/app/components/icons";

/**
 * Registers the step on screen and opens the shared assistant panel in
 * "Ayuda de este paso" mode. Only the identifiers and the learner's
 * optional doubt are sent, by the same action and rules as before.
 */
export function StepHelp({
  routeId,
  stepId,
  position,
  title,
  resolved,
}: {
  routeId: string;
  stepId: string;
  position: number;
  title: string;
  resolved: boolean;
}) {
  const { registerStep, unregisterStep, openPanel } = useAssistant();

  useEffect(() => {
    registerStep({ routeId, stepId, position, title, resolved });
  }, [registerStep, routeId, stepId, position, title, resolved]);
  useEffect(() => () => unregisterStep(stepId), [unregisterStep, stepId]);

  return (
    <section aria-label="Ayuda del paso" className="help-launcher">
      <Icon name="help" size={20} />
      <p>
        <strong>¿Necesitas ayuda con este paso?</strong>{" "}
        <span className="muted">No consume intentos de respuesta.</span>
      </p>
      <button
        className="secondary"
        onClick={(event) => openPanel("paso", event.currentTarget)}
        type="button"
      >
        Pedir ayuda
      </button>
    </section>
  );
}
