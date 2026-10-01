import { createHash } from "node:crypto";

/**
 * Builds small synthetic PDFs for tests: one page per entry, each with the
 * given text (or no content stream for an empty page). Optional standard
 * security handler (revision 2, RC4 40-bit) produces an encrypted file whose
 * pages are empty, enough to exercise password and permission detection.
 */
const passwordPadding = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);

function rc4(key: Buffer, data: Buffer): Buffer {
  const state = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + state[i] + key[i % key.length]) & 0xff;
    [state[i], state[j]] = [state[j], state[i]];
  }
  const output = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let index = 0; index < data.length; index += 1) {
    i = (i + 1) & 0xff;
    j = (j + state[i]) & 0xff;
    [state[i], state[j]] = [state[j], state[i]];
    output[index] = data[index] ^ state[(state[i] + state[j]) & 0xff];
  }
  return output;
}

function padPassword(password: string): Buffer {
  return Buffer.concat([
    Buffer.from(password, "latin1"),
    passwordPadding,
  ]).subarray(0, 32);
}

function md5(...parts: Buffer[]): Buffer {
  const hash = createHash("md5");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function escapeText(text: string): string {
  return text.replace(/[\\()]/g, (character) => `\\${character}`);
}

export function syntheticPdf(
  pages: (string | null)[],
  options: { userPassword?: string; ownerPassword?: string } = {},
): Buffer {
  const encrypt =
    options.userPassword !== undefined || options.ownerPassword !== undefined;
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[fontId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let next = 4;
  for (const text of pages) {
    const pageId = next++;
    pageIds.push(pageId);
    if (text === null || encrypt) {
      objects[pageId] =
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>";
      continue;
    }
    const contentId = next++;
    const lines = text.split("\n");
    const stream = [
      "BT /F1 12 Tf 72 720 Td 14 TL",
      ...lines.map((line) => `(${escapeText(line)}) Tj T*`),
      "ET",
    ].join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const fileId = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  let trailerExtra = "";
  if (encrypt) {
    const permissions = -44;
    const ownerKey = md5(
      padPassword(options.ownerPassword ?? options.userPassword ?? ""),
    ).subarray(0, 5);
    const owner = rc4(ownerKey, padPassword(options.userPassword ?? ""));
    const permissionBytes = Buffer.alloc(4);
    permissionBytes.writeInt32LE(permissions);
    const key = md5(
      padPassword(options.userPassword ?? ""),
      owner,
      permissionBytes,
      fileId,
    ).subarray(0, 5);
    const user = rc4(key, passwordPadding);
    const encryptId = next++;
    objects[encryptId] =
      `<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P ${permissions} >>`;
    trailerExtra = ` /Encrypt ${encryptId} 0 R`;
  }

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(body, "latin1");
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    body += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R /ID [<${fileId.toString("hex")}> <${fileId.toString("hex")}>]${trailerExtra} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
