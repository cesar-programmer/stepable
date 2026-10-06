import { codeHoleMarker, type StepCode } from "@/modules/routes/contract";

const originLabels: Record<StepCode["origin"], string> = {
  fuente: "Código copiado de la fuente",
  ilustrativo: "Ejemplo ilustrativo: no es código real de la empresa",
};

/**
 * Read-only snippet rendered as escaped text: whitespace is preserved and
 * nothing is executed, highlighted or interpreted as HTML.
 */
export function CodeBlock({ code }: { code: StepCode }) {
  return (
    <figure className="code-block">
      <figcaption className="muted">
        {originLabels[code.origin]}
        {code.language ? ` · ${code.language}` : ""}
      </figcaption>
      <pre>
        <code>
          {code.content.split(codeHoleMarker).map((part, index) => (
            <span key={index}>
              {index > 0 ? (
                <mark aria-label="hueco" className="code-hole">
                  {codeHoleMarker}
                </mark>
              ) : null}
              {part}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
