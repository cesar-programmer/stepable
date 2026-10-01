import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { SourceFileStorage } from "../../modules/sources/contract.ts";

export const sourceBucket = "fuentes";

/** Private bucket access; only server and worker processes hold this key. */
export class SupabaseSourceStorage implements SourceFileStorage {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async upload(
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(sourceBucket)
      .upload(key, bytes, { contentType, upsert: false });
    if (error) {
      throw new Error("No fue posible guardar el original.", { cause: error });
    }
  }

  async download(key: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage
      .from(sourceBucket)
      .download(key);
    if (error || !data) {
      throw new Error("No fue posible leer el original.", { cause: error });
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    await this.removeMany([key]);
  }

  /** Missing objects are ignored, so a repeated purge is idempotent. */
  async removeMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const { error } = await this.client.storage.from(sourceBucket).remove(keys);
    if (error) {
      throw new Error("No fue posible eliminar el original.", {
        cause: error,
      });
    }
  }
}
