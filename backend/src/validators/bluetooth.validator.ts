import { z } from 'zod'

const BT_MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/

export const btAddressParamSchema = z.object({
  address: z.string().regex(BT_MAC_REGEX, 'Invalid BT MAC format'),
})

export const btScanQuerySchema = z.object({
  duration: z.coerce.number().int().min(5).max(30).optional(),
})
