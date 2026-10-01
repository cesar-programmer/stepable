import type {
  ChatCompletion,
  ChatModel,
  TextEmbedder,
} from "../../modules/knowledge/contract.ts";

/**
 * Deterministic stand-ins for technical tests only. They exercise the
 * pipeline (prompt, parsing, citations, storage) but say nothing about the
 * quality of a real assistant.
 */
export class SimulatedChatModel implements ChatModel {
  readonly label = "simulado";

  async complete(input: { user: string }): Promise<ChatCompletion> {
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
