import { Worker } from "node:worker_threads";

import {
  pdfMaxPages,
  type PdfExtractionResult,
  type PdfTextExtractor,
} from "../../modules/sources/contract.ts";

const threadUrl = new URL("./pdf-extraction-thread.ts", import.meta.url);

/**
 * Runs pdf.js in a separate thread with a memory cap and a time limit, so a
 * pathological PDF cannot block or exhaust the worker process. The time limit
 * stays below the 60 s pg-boss expiration of the job.
 */
export class WorkerThreadPdfExtractor implements PdfTextExtractor {
  readonly #timeoutMs: number;
  readonly #memoryMb: number;

  constructor(options: { timeoutMs?: number; memoryMb?: number } = {}) {
    this.#timeoutMs = options.timeoutMs ?? 45_000;
    this.#memoryMb = options.memoryMb ?? 256;
  }

  extract(bytes: Uint8Array): Promise<PdfExtractionResult> {
    return new Promise((resolve) => {
      const thread = new Worker(threadUrl, {
        resourceLimits: { maxOldGenerationSizeMb: this.#memoryMb },
      });
      let settled = false;
      const finish = (result: PdfExtractionResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void thread.terminate();
        resolve(result);
      };
      const timer = setTimeout(
        () => finish({ kind: "transient", code: "tiempo_agotado" }),
        this.#timeoutMs,
      );

      thread.once("message", (result: PdfExtractionResult) => finish(result));
      thread.once("error", (error: Error & { code?: string }) =>
        finish(
          error.code === "ERR_WORKER_OUT_OF_MEMORY"
            ? { kind: "rejected", code: "pdf_demasiado_complejo" }
            : { kind: "transient", code: "error_interno" },
        ),
      );
      thread.once("exit", () =>
        finish({ kind: "transient", code: "error_interno" }),
      );

      // A fresh copy owns its ArrayBuffer; Buffer views of the shared pool
      // cannot be transferred.
      const copy = new Uint8Array(bytes);
      try {
        thread.postMessage({ bytes: copy, maxPages: pdfMaxPages }, [
          copy.buffer,
        ]);
      } catch {
        finish({ kind: "transient", code: "error_interno" });
      }
    });
  }
}
