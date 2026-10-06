import type {
  ChatCompletion,
  ChatModel,
  TextEmbedder,
} from "../../modules/knowledge/contract.ts";
import {
  stepExplanationMarker,
  stepHintMarker,
} from "../../modules/learning/help-prompt.ts";
import {
  requestedActivitiesMarker,
  routePromptMarker,
} from "../../modules/routes/generation.ts";

/**
 * Deterministic stand-ins for technical tests only. They exercise the
 * pipeline (prompt, parsing, citations, storage) but say nothing about the
 * quality of a real assistant.
 */
export class SimulatedChatModel implements ChatModel {
  readonly label = "simulado";
  readonly pricingKey = "simulado";

  async complete(input: {
    system: string;
    user: string;
  }): Promise<ChatCompletion> {
    if (input.system.includes(routePromptMarker))
      return simulatedRoute(input.system, input.user);
    const first = /<fragmento id="(\d+)"[^>]*>\n([\s\S]*?)\n<\/fragmento>/.exec(
      input.user,
    );
    if (!first) {
      return { text: JSON.stringify({ estado: "insuficiente", citas: [] }) };
    }
    const excerpt = first[2].replace(/\s+/g, " ").slice(0, 200);
    const prefix = input.system.includes(stepHintMarker)
      ? "Pista simulada"
      : input.system.includes(stepExplanationMarker)
        ? "Explicación simulada"
        : "Respuesta simulada";
    return {
      text: JSON.stringify({
        estado: "respondida",
        respuesta: `${prefix} a partir de la documentación: ${excerpt} [${first[1]}]`,
        citas: [Number(first[1])],
      }),
    };
  }
}

/**
 * Three steps citing the received fragments in turn, using only the
 * requested activity types (each at least once). Code types need a fenced
 * code block in some fragment; without one the draft is insufficient.
 */
function simulatedRoute(system: string, user: string): ChatCompletion {
  const insufficient = {
    text: JSON.stringify({ estado: "insuficiente", pasos: [] }),
  };
  const fragments = [
    ...user.matchAll(/<fragmento id="(\d+)"[^>]*>\n([\s\S]*?)\n<\/fragmento>/g),
  ];
  if (fragments.length === 0) return insufficient;
  const requested = (
    new RegExp(`^${requestedActivitiesMarker} (.+)$`, "m").exec(system)?.[1] ??
    "opcion_multiple"
  ).split(", ");
  const withCode = fragments
    .map(([, ref, content]) => ({
      ref,
      block: /```([\w+#.-]*)\n([\s\S]*?)\n```/.exec(content),
    }))
    .find((candidate) => candidate.block);
  const needsCode = requested.some((type) => type !== "opcion_multiple");
  if (needsCode && !withCode?.block) return insufficient;

  const kinds = [0, 1, 2].map((index) => requested[index] ?? requested[0]);
  const pasos = kinds.map((kind, index) => {
    const [, ref, content] =
      kind !== "opcion_multiple" && withCode
        ? (fragments.find(([, candidate]) => candidate === withCode.ref) ??
          fragments[0])
        : fragments[index % fragments.length];
    const excerpt = content.replace(/\s+/g, " ").slice(0, 160);
    const base = {
      titulo: `Paso simulado ${index + 1}`,
      leccion: `Según la documentación: ${excerpt} [${ref}]`,
      citas: [Number(ref)],
      explicacion: `Lo indica el fragmento [${ref}].`,
    };
    const block = withCode?.block;
    const identifier = block
      ? /\b[A-Za-z_][A-Za-z0-9_]{3,}\b/.exec(block[2])
      : null;
    if (kind === "completar" && block && identifier) {
      return {
        ...base,
        // The lesson must not show the completed line.
        leccion: `Completa el código según la documentación [${ref}].`,
        tipo: "completar",
        codigo: `${block[2].slice(0, identifier.index)}[[hueco]]${block[2].slice(identifier.index + identifier[0].length)}`,
        lenguaje: block[1] || null,
        origen_codigo: "fuente",
        pregunta: `Completa el hueco con el fragmento exacto del fragmento ${ref}.`,
        opciones: [],
        correcta: null,
        respuestas_aceptadas: [identifier[0]],
      };
    }
    const reading = kind === "lectura_codigo" && block;
    return {
      ...base,
      tipo: "opcion_multiple",
      codigo: reading ? block[2] : null,
      lenguaje: reading ? block[1] || null : null,
      origen_codigo: reading ? "fuente" : null,
      pregunta: reading
        ? `¿Qué hace el código del fragmento ${ref}?`
        : `¿Qué indica el fragmento ${ref}?`,
      opciones: ["Lo que dice la documentación", "Otra cosa", "Nada"],
      correcta: 0,
      respuestas_aceptadas: null,
    };
  });
  return {
    text: JSON.stringify({
      estado: "generado",
      titulo: "Ruta simulada",
      pasos,
    }),
  };
}

const dimensions = 64;

function normalizeWord(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().slice(0, 5);
}

/** Hashed bag of word prefixes: lexical overlap, not semantics. */
export class SimulatedEmbedder implements TextEmbedder {
  readonly model = "simulado:bolsa-de-palabras-64";

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = new Array<number>(dimensions).fill(0);
      for (const word of text.split(/[^\p{L}\p{N}]+/u)) {
        if (word.length < 3) continue;
        let hash = 0;
        for (const character of normalizeWord(word)) {
          hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        }
        vector[hash % dimensions] += 1;
      }
      const norm = Math.hypot(...vector) || 1;
      return vector.map((value) => (value === 0 ? 0 : value / norm));
    });
  }
}
