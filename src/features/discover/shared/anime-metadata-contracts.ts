import { z } from 'zod'

export interface AnimeDate {
  year: number | null
  month: number | null
  day: number | null
}

export interface AnimeTitles {
  display: string
  english: string | null
  romaji: string | null
  native: string | null
}

export const animeDateSchema: z.ZodType<AnimeDate> = z.object({
  year: z.number().int().nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
}).strict()

export const animeTitlesSchema: z.ZodType<AnimeTitles> = z.object({
  display: z.string().trim().min(1),
  english: z.string().trim().min(1).nullable(),
  romaji: z.string().trim().min(1).nullable(),
  native: z.string().trim().min(1).nullable(),
}).strict()
