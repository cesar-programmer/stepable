import {
  maxExtractedCharacters,
  type ExtractionResult,
  type SourceSection,
} from "./contract.ts";

const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
const headingPattern = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;

function decodeStrictUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function headingTitle(raw: string | undefined): string {
  const title = (raw ?? "").replace(/(?:^|[ \t]+)#+[ \t]*$/, "").trim();
  return title.length > 0 ? title : "(sin título)";
}

type OpenSection = {
  headingPath: string[];
  startLine: number;
  lines: string[];
};

function closeSection(section: OpenSection, sections: SourceSection[]): void {
  let lines = section.lines;
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines = lines.slice(0, -1);
  }
  const content = lines.join("\n");
  if (!/\S/.test(content)) return;

  sections.push({
    ordinal: sections.length,
    headingPath: section.headingPath,
    startLine: section.startLine,
    endLine: section.startLine + lines.length - 1,
    pageNumber: null,
    content,
  });
}

export function extractMarkdown(bytes: Uint8Array): ExtractionResult {
  const decoded = decodeStrictUtf8(bytes);
  if (decoded === null || decoded.includes("\u0000")) {
    return { ok: false, code: "codificacion_invalida" };
  }

  const text = decoded.replace(/\r\n?/g, "\n");
  if (!/\S/.test(text)) {
    return { ok: false, code: "contenido_vacio" };
  }
  if (text.length > maxExtractedCharacters) {
    return { ok: false, code: "texto_demasiado_extenso" };
  }

  const sections: SourceSection[] = [];
  const headings: { level: number; title: string }[] = [];
  let fence: { marker: string; length: number } | null = null;
  let current: OpenSection = { headingPath: [], startLine: 1, lines: [] };

  text.split("\n").forEach((line, index) => {
    const lineNumber = index + 1;
    const fenceMatch = fencePattern.exec(line);

    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.marker &&
        fenceMatch[1].length >= fence.length &&
        line.trim() === fenceMatch[1]
      ) {
        fence = null;
      }
      current.lines.push(line);
      return;
    }

    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      current.lines.push(line);
      return;
    }

    const headingMatch = headingPattern.exec(line);
    if (!headingMatch) {
      current.lines.push(line);
      return;
    }

    closeSection(current, sections);
    const level = headingMatch[1].length;
    while (
      headings.length > 0 &&
      headings[headings.length - 1].level >= level
    ) {
      headings.pop();
    }
    headings.push({ level, title: headingTitle(headingMatch[2]) });
    current = {
      headingPath: headings.map((heading) => heading.title),
      startLine: lineNumber,
      lines: [line],
    };
  });
  closeSection(current, sections);

  return { ok: true, sections, pageCount: null };
}
