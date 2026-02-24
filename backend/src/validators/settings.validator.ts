import { z } from 'zod'

export const updateSettingsSchema = z.object({
  default_volume: z.number().int().min(0).max(100).optional(),
  bt_auto_register: z.boolean().optional(),
  bt_auto_reconnect: z.boolean().optional(),
  bt_monitoring_interval: z.number().int().min(5).max(60).optional(),
  bt_scan_duration: z.number().int().min(5).max(30).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one setting required' })
