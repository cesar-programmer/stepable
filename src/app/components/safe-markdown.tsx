import { Fragment, type ReactNode } from "react";

import { type Inline, parseMarkdown } from "./markdown";

/**
 * Renders the Markdown subset of `markdown.ts` as React text. A citation
 * marker becomes a link only when every number in it is a verified citation
 * (`citationAnchors` maps the number to the id of its entry in the list).
 */
export function SafeMarkdown({
  text,
  citationAnchors,
  className = "markdown",
}: {
  text: string;
  citationAnchors?: ReadonlyMap<number, string>;
  className?: string;
}) {
  const inline = (content: Inline[]) =>
    content.map((part, index) => {
      if (part.type === "code") return <code key={index}>{part.text}</code>;
      if (part.type === "strong")
        return <strong key={index}>{part.text}</strong>;
      if (
        part.type === "cite" &&
        citationAnchors &&
        part.refs.every((ref) => citationAnchors.has(ref))
      ) {
        return (
          <span className="cite-group" key={index}>
            {part.refs.map((ref) => (
              <a
                aria-label={`Cita ${ref}`}
                className="cite-ref"
                href={`#${citationAnchors.get(ref)}`}
                key={ref}
              >
                {ref}
              </a>
            ))}
          </span>
        );
      }
      return <Fragment key={index}>{part.text}</Fragment>;
    });

  return (
    <div className={className}>
      {parseMarkdown(text).map((block, index): ReactNode => {
        switch (block.type) {
          case "heading":
            return (
              <p className="markdown-heading" key={index}>
                {inline(block.content)}
              </p>
            );
          case "code":
            return (
              <pre className="markdown-code" key={index} tabIndex={0}>
                <code>{block.text}</code>
              </pre>
            );
          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inline(item)}</li>
            ));
            return block.ordered ? (
              <ol key={index} start={block.start}>
                {items}
              </ol>
            ) : (
              <ul key={index}>{items}</ul>
            );
          }
          case "paragraph":
            return (
              <p key={index}>
                {block.lines.map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 ? <br /> : null}
                    {inline(line)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
