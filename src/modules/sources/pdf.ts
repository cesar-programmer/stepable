import {
  maxExtractedCharacters,
  type ExtractionResult,
  type PdfPageText,
  type SourceSection,
} from "./contract.ts";

function normalizePageText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * One section per page with extractable text. Pages without text are skipped;
 * a document is accepted when at least one page has non-blank text (no OCR).
 */
export function pdfPagesToSections(
  pageCount: number,
  pages: PdfPageText[],
): ExtractionResult {
  const sections: SourceSection[] = [];
  let characters = 0;

  for (const page of pages) {
    const content = normalizePageText(page.text);
    if (!/\S/.test(content)) continue;
    characters += content.length;
    if (characters > maxExtractedCharacters) {
      return { ok: false, code: "texto_demasiado_extenso" };
    }
    sections.push({
      ordinal: sections.length,
      headingPath: [],
      startLine: null,
      endLine: null,
      pageNumber: page.pageNumber,
      content,
    });
  }

  return sections.length === 0
    ? { ok: false, code: "sin_texto_extraible" }
    : { ok: true, sections, pageCount };
}
