import { z } from 'zod'

export const updateSettingsSchema = z.object({
  default_volume: z.number().int().min(0).max(100),
})
