"use client";

import { useState, type InputHTMLAttributes } from "react";

/** Password field with a show/hide toggle that keeps the label intact. */
export function PasswordInput(
  properties: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
    id: string;
  },
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input {...properties} type={visible ? "text" : "password"} />
      <button
        aria-controls={properties.id}
        aria-pressed={visible}
        className="ghost small"
        onClick={() => setVisible(!visible)}
        type="button"
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
