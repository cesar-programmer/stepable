"use client";

import {
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type MouseEvent,
} from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The question shown before submitting; say what will happen. */
  message: string;
  /** Label of the confirming action (defaults to "Confirmar"). */
  confirmLabel?: string;
  /** Destructive: the confirming action is red (default: a "danger" class). */
  destructive?: boolean;
};

/**
 * A submit button that asks first, in the app's own dialog (theme, motion
 * and focus included) instead of the browser's. Confirming submits the same
 * form with this button as submitter; cancelling returns focus to it.
 */
export function ConfirmSubmitButton({
  message,
  confirmLabel = "Confirmar",
  destructive,
  onClick,
  children,
  className,
  ...properties
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const id = useId();
  const danger = destructive ?? className?.split(" ").includes("danger");

  function askFirst(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    dialog.current?.showModal();
  }

  function confirm() {
    confirmed.current = true;
    dialog.current?.close();
    // Submits without a click, so askFirst does not run again.
    const submitter = button.current;
    submitter?.form?.requestSubmit(submitter);
  }

  return (
    <>
      <button
        {...properties}
        aria-busy={pending || undefined}
        className={className}
        disabled={pending || properties.disabled}
        onClick={askFirst}
        ref={button}
        type="submit"
      >
        {pending ? <span aria-hidden="true" className="spinner" /> : null}
        {children}
      </button>
      <dialog
        aria-labelledby={`${id}-title`}
        className="modal confirm-dialog"
        onClose={() => {
          // Cancelled: back to the button. Each opening asks again.
          if (!confirmed.current) button.current?.focus();
          confirmed.current = false;
        }}
        ref={dialog}
      >
        <h2 id={`${id}-title`}>{message}</h2>
        <div className="actions">
          <button
            className={danger ? "danger" : undefined}
            onClick={confirm}
            type="button"
          >
            {confirmLabel}
          </button>
          <button
            autoFocus
            className="secondary"
            onClick={() => dialog.current?.close()}
            type="button"
          >
            Cancelar
          </button>
        </div>
      </dialog>
    </>
  );
}
