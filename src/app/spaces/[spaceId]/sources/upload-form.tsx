"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/app/components/icons";
import { Presence } from "@/app/components/motion";

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * The same multipart POST as before; it only shows the chosen file and
 * acknowledges the submit (no second submit, no invented progress: the
 * server reports the processing state in the list).
 */
export function SourceUploadForm({ action }: { action: string }) {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [sending, setSending] = useState(false);

  // Coming back with the browser's history restores the page as it was.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setSending(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      action={action}
      encType="multipart/form-data"
      method="post"
      onSubmit={(event) => {
        if (sending) event.preventDefault();
        else setSending(true);
      }}
    >
      <label>
        Archivo Markdown (hasta 1 MiB) o PDF con texto (hasta 8 MiB y 200
        páginas)
        <input
          accept=".md,.markdown,.pdf,text/markdown,application/pdf"
          name="file"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            setFile(chosen ? { name: chosen.name, size: chosen.size } : null);
          }}
          required
          type="file"
        />
      </label>
      <Presence show={file !== null}>
        <p className="file-chosen" role="status">
          <Icon name="sources" size={18} />
          <span>{file?.name}</span>
          <span className="muted">{file ? formatSize(file.size) : ""}</span>
        </p>
      </Presence>
      <label>
        Título (opcional)
        <input maxLength={120} name="title" type="text" />
      </label>
      <button aria-busy={sending || undefined} disabled={sending} type="submit">
        {sending ? <span aria-hidden="true" className="spinner" /> : null}
        {sending ? "Cargando…" : "Cargar fuente"}
      </button>
    </form>
  );
}
