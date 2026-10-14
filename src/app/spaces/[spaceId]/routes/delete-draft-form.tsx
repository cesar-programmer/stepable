import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { Icon } from "@/app/components/icons";

import { deleteDraftAction } from "./actions";

/**
 * "Eliminar" for a draft, wherever it is listed. It asks first, in the
 * app's dialog; while the draft is being generated it waits (RN-40).
 */
export function DeleteDraftForm({
  spaceId,
  routeId,
  title,
  from,
  generating,
  label = "Eliminar",
}: {
  spaceId: string;
  routeId: string;
  title: string;
  from: "inicio" | "rutas" | "ruta";
  generating: boolean;
  label?: string;
}) {
  return (
    <form action={deleteDraftAction} className="inline-form">
      <input name="spaceId" type="hidden" value={spaceId} />
      <input name="routeId" type="hidden" value={routeId} />
      <input name="from" type="hidden" value={from} />
      <ConfirmSubmitButton
        aria-label={`${label} el borrador «${title}»`}
        className="ghost small danger-text"
        confirmLabel="Eliminar borrador"
        destructive
        disabled={generating}
        message={`¿Eliminar el borrador «${title}»? Se borran sus pasos y no hay papelera. Los intentos de generación ya usados hoy siguen contando.`}
        title={
          generating
            ? "Se está generando; podrás eliminarlo cuando termine."
            : undefined
        }
      >
        <Icon name="trash" size={16} />
        {label}
      </ConfirmSubmitButton>
    </form>
  );
}
