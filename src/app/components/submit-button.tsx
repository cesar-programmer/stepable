"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button that reflects the real pending state of its form: disabled
 * and marked busy while the request runs, never delayed for effect.
 */
export function SubmitButton({
  pendingLabel,
  children,
  className,
  ...properties
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...properties}
      aria-busy={pending || undefined}
      className={className}
      disabled={pending || properties.disabled}
      type="submit"
    >
      {pending ? <span aria-hidden="true" className="spinner" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
