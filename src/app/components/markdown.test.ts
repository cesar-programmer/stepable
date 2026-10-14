import { describe, expect, it } from "vitest";

import { parseInline, parseMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  it("splits paragraphs, keeps line breaks and reads lists", () => {
    expect(
      parseMarkdown(
        "Primera línea\nsegunda\n\n- uno\n- dos\n  sigue\n\n3. tres",
      ),
    ).toEqual([
      {
        type: "paragraph",
        lines: [
          [{ type: "text", text: "Primera línea" }],
          [{ type: "text", text: "segunda" }],
        ],
      },
      {
        type: "list",
        ordered: false,
        start: 1,
        items: [
          [{ type: "text", text: "uno" }],
          [{ type: "text", text: "dos sigue" }],
        ],
      },
      {
        type: "list",
        ordered: true,
        start: 3,
        items: [[{ type: "text", text: "tres" }]],
      },
    ]);
  });

  it("keeps fenced code verbatim, even when it is not closed", () => {
    expect(parseMarkdown("```ts\nconst a = `x`;\n```\n```\n**no**")).toEqual([
      { type: "code", language: "ts", text: "const a = `x`;" },
      { type: "code", language: "", text: "**no**" },
    ]);
  });

  it("treats HTML as text instead of markup", () => {
    expect(parseMarkdown('<img src=x onerror="alert(1)"> hola')).toEqual([
      {
        type: "paragraph",
        lines: [
          [{ type: "text", text: '<img src=x onerror="alert(1)"> hola' }],
        ],
      },
    ]);
  });

  it("reads headings", () => {
    expect(parseMarkdown("## Despliegue ##")).toEqual([
      { type: "heading", content: [{ type: "text", text: "Despliegue" }] },
    ]);
  });
});

describe("parseInline", () => {
  it("recognizes code, bold and numeric citations only", () => {
    expect(
      parseInline("Usa `git tag` y **revisa** [1, 2] o [código] [x]"),
    ).toEqual([
      { type: "text", text: "Usa " },
      { type: "code", text: "git tag" },
      { type: "text", text: " y " },
      { type: "strong", text: "revisa" },
      { type: "text", text: " " },
      { type: "cite", refs: [1, 2], text: "[1, 2]" },
      { type: "text", text: " o [código] [x]" },
    ]);
  });
});
