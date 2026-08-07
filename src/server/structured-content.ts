/**
 * Helper tipado para `structuredContent` en respuestas MCP.
 *
 * Reemplaza los casts `as unknown as Record<string, unknown>` dispersos en
 * handlers de tools. Forza el valor a `Record<string, unknown>` solo cuando
 * el cliente MCP lo requiere, manteniendo el tipado en el código fuente.
 *
 * Uso:
 *   structuredContent: asStructured(result)
 */
export function asStructured(value: object): Record<string, unknown> {
  return value as Record<string, unknown>
}
