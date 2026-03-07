import { z } from 'zod'

export const youtubeDetailsSchema = z.object({
  url: z.string().url(),
})

export type YoutubeDetailsInput = z.infer<typeof youtubeDetailsSchema>
