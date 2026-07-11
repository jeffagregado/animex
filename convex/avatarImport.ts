const MAX_REDIRECTS = 3

type FetchAvatar = (input: string, init: RequestInit) => Promise<Response>

export const validateProviderAvatarUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (
      url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com')
    )
  } catch {
    return false
  }
}

export const detectAvatarMediaType = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 12) {
    const text = new TextDecoder().decode(bytes.slice(0, 12))
    if (text.startsWith('RIFF') && text.endsWith('WEBP')) return 'image/webp'
  }
  return null
}

const isRedirectResponse = (response: Response): boolean => {
  return response.status >= 300 && response.status < 400
}

// Resolve and validate one provider redirect.
const readRedirectUrl = (
  response: Response,
  currentUrl: string,
  redirectCount: number,
): string | null => {
  if (!isRedirectResponse(response)) return null
  if (redirectCount === MAX_REDIRECTS) {
    throw new Error('Provider avatar exceeded redirect limit.')
  }
  const location = response.headers.get('location')
  if (!location) throw new Error('Provider avatar redirect is missing a location.')
  const redirectedUrl = new URL(location, currentUrl).href
  if (!validateProviderAvatarUrl(redirectedUrl)) {
    throw new Error('Provider avatar redirect is not approved.')
  }
  return redirectedUrl
}

// Fetch the final approved provider response.
const fetchFinalAvatarResponse = async (
  fetchAvatar: FetchAvatar,
  initialUrl: string,
  signal: AbortSignal,
): Promise<Response> => {
  let currentUrl = initialUrl
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!validateProviderAvatarUrl(currentUrl)) {
      throw new Error('Provider avatar URL is not approved.')
    }
    let response: Response
    try {
      response = await fetchAvatar(currentUrl, { redirect: 'manual', signal })
    } catch {
      throw new Error('Provider avatar request failed.')
    }
    const redirectedUrl = readRedirectUrl(response, currentUrl, redirectCount)
    if (redirectedUrl) {
      currentUrl = redirectedUrl
      continue
    }
    if (!response.ok) {
      throw new Error(`Provider avatar request failed with ${response.status}.`)
    }
    return response
  }
  throw new Error('Provider avatar exceeded redirect limit.')
}

const joinChunks = (chunks: Uint8Array[], byteLength: number): Uint8Array => {
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

// Read and cancel an avatar stream at its byte limit.
const readBoundedAvatarStream = async (
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> => {
  const declaredLength = Number(response.headers.get('content-length') ?? '0')
  if (declaredLength > maximumBytes) {
    await response.body?.cancel('Provider avatar exceeds 5 MiB.')
    throw new Error('Provider avatar exceeds 5 MiB.')
  }
  if (!response.body) throw new Error('Provider avatar response has no body.')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    if (!result.value) continue
    byteLength += result.value.byteLength
    if (byteLength > maximumBytes) {
      await reader.cancel('Provider avatar exceeds 5 MiB.')
      throw new Error('Provider avatar exceeds 5 MiB.')
    }
    chunks.push(result.value)
  }
  return joinChunks(chunks, byteLength)
}

// Validate provider bytes and create the owned avatar blob.
const createValidatedAvatarBlob = (bytes: Uint8Array): Blob => {
  const mediaType = detectAvatarMediaType(bytes)
  if (!mediaType) throw new Error('Provider avatar has unsupported image signature.')
  return new Blob([Uint8Array.from(bytes)], { type: mediaType })
}

export const fetchProviderAvatar = async (
  fetchAvatar: FetchAvatar,
  initialUrl: string,
  timeoutMs: number,
  maximumBytes: number,
): Promise<Blob> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFinalAvatarResponse(fetchAvatar, initialUrl, controller.signal)
    const bytes = await readBoundedAvatarStream(response, maximumBytes)
    return createValidatedAvatarBlob(bytes)
  } finally {
    clearTimeout(timeout)
  }
}

export const storeAvatarForProfile = async <StorageId, ProfileId>({
  blob,
  complete,
  remove,
  store,
}: {
  blob: Blob
  complete: (storageId: StorageId) => Promise<ProfileId>
  remove: (storageId: StorageId) => Promise<void>
  store: (blob: Blob) => Promise<StorageId>
}): Promise<ProfileId> => {
  const storageId = await store(blob)
  try {
    return await complete(storageId)
  } catch (error) {
    await remove(storageId)
    throw error
  }
}
