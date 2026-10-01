import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { syntheticPdf } from "../tests/support/synthetic-pdf.ts";

const directory = join(tmpdir(), "stepable-pdf-ejemplos");
mkdirSync(directory, { recursive: true });

const samples = {
  "manual-con-texto.pdf": syntheticPdf([
    "Manual sintético del equipo\nRevisar contratos de API antes de publicar.",
    null,
    "Íconos: usar siempre el set compartido.",
  ]),
  "corto.pdf": syntheticPdf(["Hola"]),
  "escaneado-sin-texto.pdf": syntheticPdf([null, null]),
  "cifrado.pdf": syntheticPdf([null], { userPassword: "secreto" }),
  "danado.pdf": Buffer.from("%PDF-1.7\nesto no es un PDF válido\n"),
  "demasiadas-paginas.pdf": syntheticPdf(
    Array.from({ length: 201 }, () => null),
  ),
};

for (const [name, bytes] of Object.entries(samples)) {
  writeFileSync(join(directory, name), bytes);
}
console.log(`PDF sintéticos escritos en ${directory}`);
