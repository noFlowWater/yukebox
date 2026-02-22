import { z } from 'zod'

export const addToQueueSchema = z.object({
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

const bulkItemSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  thumbnail: z.string().optional(),
  duration: z.number().int().min(0).optional(),
})

export const bulkAddToQueueSchema = z.object({
  items: z.array(bulkItemSchema).min(1).max(20).optional(),
  urls: z.array(z.string().url()).min(1).max(20).optional(),
  speaker_id: z.number().int().positive().optional(),
}).refine(
  (data) => data.items || data.urls,
  { message: 'Either items or urls is required' },
)

export const updatePositionSchema = z.object({
  position: z.number().int().min(0),
})

export type AddToQueueInput = z.infer<typeof addToQueueSchema>
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>
