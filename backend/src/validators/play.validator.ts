import { z } from 'zod'

export const playSchema = z.object({
  url: z.string().url().optional(),
  query: z.string().min(1).optional(),
  title: z.string().optional(),
  thumbnail: z.string().optional(),
  duration: z.number().int().min(0).optional(),
  speaker_id: z.number().int().positive().optional(),
}).refine(
  (data) => data.url || data.query,
  { message: 'Either url or query is required' },
)

export type PlayInput = z.infer<typeof playSchema>
