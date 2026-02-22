import { z } from 'zod'

export const registerSpeakerSchema = z.object({
  sink_name: z.string().min(1, 'Sink name is required'),
  display_name: z.string().min(1, 'Display name is required').max(100, 'Display name must be at most 100 characters'),
})

export const updateSpeakerSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(100, 'Display name must be at most 100 characters'),
})
