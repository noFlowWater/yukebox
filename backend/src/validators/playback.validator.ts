import { z } from 'zod'

export const volumeSchema = z.object({
  volume: z.number().int().min(0).max(100),
})

export type VolumeInput = z.infer<typeof volumeSchema>

export const seekSchema = z.object({
  position: z.number().min(0),
})

export type SeekInput = z.infer<typeof seekSchema>
