/**
 * Background work is partitioned by namespace. Normal local use is "local";
 * test commands use "pruebas". Queue names and the spaces a worker may touch
 * both depend on it, so a worker with a real model never takes test work.
 */
export const defaultJobNamespace = "local";

export function parseJobNamespace(
  values: Record<string, string | undefined>,
): string {
  const value = values.STEPABLE_JOB_NAMESPACE || defaultJobNamespace;
  if (!/^[a-z0-9_-]{1,32}$/.test(value)) {
    throw new Error("STEPABLE_JOB_NAMESPACE no es válido.");
  }
  return value;
}

/** "local" keeps the original queue names; other namespaces get a suffix. */
export function namespacedQueue(base: string, namespace: string): string {
  return namespace === defaultJobNamespace ? base : `${base}.${namespace}`;
}
