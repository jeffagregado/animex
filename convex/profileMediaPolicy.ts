export type ProfileMediaKind = 'avatar' | 'banner'
export type ProfileMediaDimensions = { width: number; height: number }
export type FetchProfileMedia = (input: string, init: RequestInit) => Promise<Response>
export type WaitForRetry = (delayMs: number) => Promise<void>
export type WarnForRetry = (message: string) => void

const MAXIMUM_BYTES = 2 * 1024 * 1024
const RETRY_DELAYS_MS = [50, 100] as const

const invalid = (message: string): never => {
  throw new Error(`PROFILE_MEDIA_INVALID: ${message}`)
}

const readText = (bytes: Uint8Array, offset: number, length: number): string =>
  new TextDecoder().decode(bytes.slice(offset, offset + length))

const readU24 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)

const readU32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)) >>> 0

const parseVp8 = (payload: Uint8Array): ProfileMediaDimensions => {
  if (
    payload.length < 10
    || payload[3] !== 0x9d
    || payload[4] !== 0x01
    || payload[5] !== 0x2a
  ) {
    return invalid('Malformed VP8 dimensions.')
  }
  const width = (payload[6] | (payload[7] << 8)) & 0x3fff
  const height = (payload[8] | (payload[9] << 8)) & 0x3fff
  if (width === 0 || height === 0) return invalid('WebP dimensions must be positive.')
  return { width, height }
}

const parseVp8l = (payload: Uint8Array): ProfileMediaDimensions => {
  if (payload.length < 5 || payload[0] !== 0x2f) {
    return invalid('Malformed VP8L dimensions.')
  }
  return {
    width: 1 + payload[1] + ((payload[2] & 0x3f) << 8),
    height: 1 + (payload[2] >>> 6) + (payload[3] << 2) + ((payload[4] & 0x0f) << 10),
  }
}

const parseVp8x = (payload: Uint8Array): ProfileMediaDimensions => {
  if (payload.length !== 10) return invalid('Malformed VP8X dimensions.')
  if ((payload[0] & 0x02) !== 0) return invalid('Animated WebP is not allowed.')
  if (
    (payload[0] & 0xc1) !== 0
    || payload[1] !== 0
    || payload[2] !== 0
    || payload[3] !== 0
  ) {
    return invalid('VP8X reserved fields must be zero.')
  }
  return {
    width: readU24(payload, 4) + 1,
    height: readU24(payload, 7) + 1,
  }
}

/** Parses one static WebP container and returns its encoded dimensions. */
export const parseWebpDimensions = (bytes: Uint8Array): ProfileMediaDimensions => {
  if (
    bytes.length < 20
    || readText(bytes, 0, 4) !== 'RIFF'
    || readText(bytes, 8, 4) !== 'WEBP'
    || readU32(bytes, 4) + 8 !== bytes.length
  ) {
    return invalid('Malformed RIFF/WEBP container.')
  }

  let offset = 12
  let canvas: ProfileMediaDimensions | null = null
  let image: ProfileMediaDimensions | null = null
  let imageKind: 'VP8' | 'VP8L' | null = null
  let hasAlphaFlag = false
  let sawAlpha = false
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) return invalid('Malformed WebP chunk header.')
    const name = readText(bytes, offset, 4)
    const length = readU32(bytes, offset + 4)
    const payloadStart = offset + 8
    const payloadEnd = payloadStart + length
    if (payloadEnd > bytes.length) return invalid('Malformed WebP chunk length.')
    if (length % 2 === 1 && (payloadEnd >= bytes.length || bytes[payloadEnd] !== 0)) {
      return invalid('Malformed WebP chunk padding.')
    }
    const payload = bytes.slice(payloadStart, payloadEnd)

    if (name === 'ANIM' || name === 'ANMF') return invalid('Animated WebP is not allowed.')
    if (name === 'VP8X') {
      if (canvas || offset !== 12 || image) return invalid('WebP has duplicate or misplaced VP8X.')
      canvas = parseVp8x(payload)
      hasAlphaFlag = (payload[0] & 0x10) !== 0
    } else if (name === 'ALPH') {
      if (!canvas || image || sawAlpha || !hasAlphaFlag || payload.length === 0) {
        return invalid('WebP has misplaced or duplicate alpha data.')
      }
      sawAlpha = true
    } else if (name === 'VP8 ' || name === 'VP8L') {
      if (image) return invalid('WebP has multiple image-data chunks.')
      image = name === 'VP8 ' ? parseVp8(payload) : parseVp8l(payload)
      imageKind = name === 'VP8 ' ? 'VP8' : 'VP8L'
    }
    offset = payloadEnd + (length % 2)
  }
  if (offset !== bytes.length || !image) return invalid('WebP image data is missing.')
  if (sawAlpha && imageKind !== 'VP8') return invalid('ALPH must precede VP8 image data.')
  if (canvas && (canvas.width !== image.width || canvas.height !== image.height)) {
    return invalid('VP8X canvas and image dimensions do not match.')
  }
  return canvas ?? image
}

/** Validates one final static crop against Profile media limits. */
export const validateProfileMedia = (
  bytes: Uint8Array,
  kind: ProfileMediaKind,
): void => {
  if (bytes.length === 0 || bytes.length > MAXIMUM_BYTES) {
    return invalid('Profile media must be nonempty and no larger than 2 MiB.')
  }
  const dimensions = parseWebpDimensions(bytes)
  const expected = kind === 'avatar'
    ? { width: 512, height: 512 }
    : { width: 1600, height: 400 }
  if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
    return invalid(`Expected ${expected.width}x${expected.height} WebP output.`)
  }
}

/** Fetches media with exactly three attempts and bounded retry delays. */
export const fetchProfileMedia = async (
  fetchMedia: FetchProfileMedia,
  url: string,
  wait: WaitForRetry,
  warn: WarnForRetry,
): Promise<Uint8Array> => {
  let lastFailure: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchMedia(url, { method: 'GET' })
      if (!response.ok) throw new Error(`Profile media fetch failed with ${response.status}.`)
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      lastFailure = error
      if (attempt < RETRY_DELAYS_MS.length) {
        warn(`Profile media fetch failed; retrying attempt ${attempt + 2} of 3.`)
        await wait(RETRY_DELAYS_MS[attempt])
      }
    }
  }
  throw lastFailure
}
