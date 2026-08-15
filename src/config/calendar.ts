/**
 * Schema de configuración de Proton Calendar.
 *
 * Extraído de src/config.ts para reducir el tamaño de la fachada principal.
 * Sin dependencias circulares — solo importa zod.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Calendar config section — subobjeto de products.calendar en ConfigSchema.
// ---------------------------------------------------------------------------
export const CalendarConfigSchema = z.object({
  enabled: z.boolean().default(false),
  experimental: z.boolean().default(false),
})

export type CalendarConfig = z.infer<typeof CalendarConfigSchema>

/** Parsea Calendar config desde env vars. */
export function parseCalendarConfig(env: NodeJS.ProcessEnv) {
  const truthy = (v: string | undefined) => v === 'true' || v === '1'
  return {
    enabled: truthy(env['PROTON_CALENDAR_ENABLED']),
    experimental: truthy(env['PROTON_CALENDAR_EXPERIMENTAL']),
  }
}
