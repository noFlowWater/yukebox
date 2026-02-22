import { z } from 'zod'

export const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
})

export type SearchInput = z.infer<typeof searchSchema>

export const resolveSchema = z.object({
  url: z.string().url(),
})

export type ResolveInput = z.infer<typeof resolveSchema>
