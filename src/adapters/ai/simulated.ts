import type {
  ChatCompletion,
  ChatModel,
  TextEmbedder,
} from "../../modules/knowledge/contract.ts";
import { routePromptMarker } from "../../modules/routes/generation.ts";

/**
 * Deterministic stand-ins for technical tests only. They exercise the
 * pipeline (prompt, parsing, citations, storage) but say nothing about the
 * quality of a real assistant.
 */
export class SimulatedChatModel implements ChatModel {
  readonly label = "simulado";

  async complete(input: {
    system: string;
    user: string;
  }): Promise<ChatCompletion> {
    if (input.system.includes(routePromptMarker))
      return simulatedRoute(input.user);
    const first = /<fragmento id="(\d+)"[^>]*>\n([\s\S]*?)\n<\/fragmento>/.exec(
      input.user,
    );
    if (!first) {
      return { text: JSON.stringify({ estado: "insuficiente", citas: [] }) };
    }
    const excerpt = first[2].replace(/\s+/g, " ").slice(0, 200);
    return {
      text: JSON.stringify({
        estado: "respondida",
        respuesta: `Respuesta simulada a partir de la documentación: ${excerpt} [${first[1]}]`,
        citas: [Number(first[1])],
      }),
    };
  }
}

/** Three steps citing the received fragments in turn. */
function simulatedRoute(user: string): ChatCompletion {
  const fragments = [
    ...user.matchAll(/<fragmento id="(\d+)"[^>]*>\n([\s\S]*?)\n<\/fragmento>/g),
  ];
  if (fragments.length === 0) {
    return { text: JSON.stringify({ estado: "insuficiente", pasos: [] }) };
  }
  const pasos = [0, 1, 2].map((index) => {
    const [, ref, content] = fragments[index % fragments.length];
    const excerpt = content.replace(/\s+/g, " ").slice(0, 160);
    return {
      titulo: `Paso simulado ${index + 1}`,
      leccion: `Según la documentación: ${excerpt} [${ref}]`,
      citas: [Number(ref)],
      pregunta: `¿Qué indica el fragmento ${ref}?`,
      opciones: ["Lo que dice la documentación", "Otra cosa", "Nada"],
      correcta: 0,
      explicacion: `Lo indica el fragmento [${ref}].`,
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
