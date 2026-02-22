import { z } from 'zod'

export const createScheduleSchema = z.object({
  url: z.string().url().optional(),
  query: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  thumbnail: z.string().optional(),
  duration: z.number().int().min(0).optional(),
  speaker_id: z.number().int().positive().optional(),
  group_id: z.string().min(1).optional(),
  scheduled_at: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Must be a valid ISO datetime string' },
  ),
}).refine(
  (data) => data.url || data.query,
  { message: 'Either url or query is required' },
)

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
