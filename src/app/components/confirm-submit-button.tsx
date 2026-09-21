"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string;
};

export function ConfirmSubmitButton({
  message,
  onClick,
  ...properties
}: ConfirmSubmitButtonProps) {
  function confirmSubmission(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (!event.defaultPrevented && !window.confirm(message)) {
      event.preventDefault();
    }
  }

  return <button {...properties} onClick={confirmSubmission} type="submit" />;
}
