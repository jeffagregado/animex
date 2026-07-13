import { useEffect, useRef, useState } from 'react'

type AnimeAutosaveOptions<Value> = {
  delayMs: number
  isValid: (value: Value) => boolean
  persist: (action: () => Promise<unknown>) => void
  save: (value: Value) => Promise<unknown>
  serverValue: Value
}

type AnimeAutosave<Value> = {
  cancel: () => void
  flush: (value: Value) => void
  schedule: (value: Value) => void
  setDraft: (value: Value) => void
  value: Value
}

type ScoreAnimeAutosave = {
  clear: () => void
  commit: () => void
  error: string | null
  schedule: (value: number | null) => void
  value: number | null
}

/** Keeps an editable value until a confirmed save or clean server refresh. */
export function useAnimeAutosave<Value>({ delayMs, isValid, persist, save, serverValue }: AnimeAutosaveOptions<Value>): AnimeAutosave<Value> {
  const [value, setValue] = useState<Value>(serverValue)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedValueRef = useRef<Value>(serverValue)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (dirtyRef.current) return
    savedValueRef.current = serverValue
    setValue(serverValue)
  }, [serverValue])

  useEffect(() => () => clearTimeoutRef(timeoutRef), [])

  const flush = (nextValue: Value): void => {
    clearTimeoutRef(timeoutRef)
    if (nextValue === savedValueRef.current || !isValid(nextValue)) return
    persist(async () => {
      await save(nextValue)
      savedValueRef.current = nextValue
      dirtyRef.current = false
    })
  }

  const cancel = (): void => clearTimeoutRef(timeoutRef)

  const setDraft = (nextValue: Value): void => {
    setValue(nextValue)
    clearTimeoutRef(timeoutRef)
    dirtyRef.current = nextValue !== savedValueRef.current
  }

  const schedule = (nextValue: Value): void => {
    if (!isValid(nextValue)) return
    setDraft(nextValue)
    if (!dirtyRef.current) return
    timeoutRef.current = setTimeout(() => flush(nextValue), delayMs)
  }

  return { cancel, flush, schedule, setDraft, value }
}

/** Adds explicit half-step validation to score autosave. */
export function useScoreAnimeAutosave({ delayMs, persist, save, serverValue }: Omit<AnimeAutosaveOptions<number | null>, 'isValid'>): ScoreAnimeAutosave {
  const [error, setError] = useState<string | null>(null)
  const autosave = useAnimeAutosave<number | null>({ delayMs, isValid: isValidScore, persist, save, serverValue })

  const schedule = (value: number | null): void => {
    if (!isValidScore(value)) {
      autosave.cancel()
      setError('Score must use 0.5 increments.')
      return
    }
    setError(null)
    autosave.schedule(value)
  }

  const clear = (): void => {
    setError(null)
    autosave.setDraft(null)
    autosave.flush(null)
  }

  const commit = (): void => {
    if (error) return
    autosave.flush(autosave.value)
  }

  return { clear, commit, error, schedule, value: autosave.value }
}

/** Clears one pending trailing save. */
function clearTimeoutRef(timeoutRef: { current: ReturnType<typeof setTimeout> | null }): void {
  if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
  timeoutRef.current = null
}

/** Validates the allowed score range and half-point increment. */
function isValidScore(score: number | null): boolean {
  return score === null || (score >= 0 && score <= 10 && Number.isInteger(score * 2))
}
