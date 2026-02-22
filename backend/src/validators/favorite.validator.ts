import { z } from 'zod'

export const addFavoriteSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  thumbnail: z.string(),
  duration: z.number().int().min(0),
})

export const checkBulkFavoritesSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
})

export type AddFavoriteInput = z.infer<typeof addFavoriteSchema>
export type CheckBulkFavoritesInput = z.infer<typeof checkBulkFavoritesSchema>
