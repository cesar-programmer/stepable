/**
 * A deliberately small Markdown subset for AI answers and source fragments:
 * paragraphs, headings, lists, fenced code, inline code, bold and numeric
 * citation markers. It produces plain data that is rendered as React text,
 * so HTML in the input is never interpreted and links are never created
 * from the input.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; text: string }
  | { type: "cite"; refs: number[]; text: string };

export type Block =
  | { type: "paragraph"; lines: Inline[][] }
  | { type: "heading"; content: Inline[] }
  | { type: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { type: "code"; language: string; text: string };

const inlinePattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[\d+(?:\s*,\s*\d+)*\])/g;

export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      result.push({ type: "text", text: text.slice(last, index) });
    }
    const [token] = match;
    if (match[1]) result.push({ type: "code", text: token.slice(1, -1) });
    else if (match[2])
      result.push({ type: "strong", text: token.slice(2, -2) });
    else {
      const refs = token
        .slice(1, -1)
        .split(",")
        .map((value) => Number(value.trim()));
      result.push({ type: "cite", refs, text: token });
    }
    last = index + token.length;
  }
  if (last < text.length) result.push({ type: "text", text: text.slice(last) });
  return result;
}

const fencePattern = /^\s*```\s*([\w+-]*)\s*$/;
const headingPattern = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const bulletPattern = /^\s{0,3}[-*+]\s+(.*)$/;
const numberedPattern = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraph.map(parseInline) });
      paragraph = [];
    }
    if (list) {
      blocks.push({
        type: "list",
        ordered: list.ordered,
        start: list.start,
        items: list.items.map(parseInline),
      });
      list = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = fencePattern.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      index += 1;
      // An unclosed fence keeps the rest as code instead of dropping it.
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: "code", language: fence[1], text: code.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    const heading = headingPattern.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", content: parseInline(heading[1]) });
      continue;
    }
    const bullet = bulletPattern.exec(line);
    const numbered = bullet ? null : numberedPattern.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (paragraph.length > 0 || (list && list.ordered !== ordered)) flush();
      if (!list) {
        list = {
          ordered,
          start: numbered ? Number(numbered[1]) : 1,
          items: [],
        };
      }
      list.items.push((bullet ? bullet[1] : numbered![2]).trim());
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      // An indented line continues the previous item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (list) flush();
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
