// Case modes applied to download metadata fields (artist/title).
// Every step is computed from the base text so cycling back
// to step 0 always restores the exact original value.
export const CASE_STEP_COUNT = 6

export function toSentenceCase (value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function toTitleCase (value: string): string {
  return value.toLowerCase().replace(/(^|\s)\S/g, match => match.toUpperCase())
}

export function toLowerCase (value: string): string {
  return value.toLowerCase()
}

export function toUpperCase (value: string): string {
  return value.toUpperCase()
}

// Capitalize only the first character, preserving the rest untouched
// (e.g. band names with internal capitals such as "AC/DC").
export function capitalizeFirst (value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function applyCaseStep (base: string, step: number): string {
  switch (((step % CASE_STEP_COUNT) + CASE_STEP_COUNT) % CASE_STEP_COUNT) {
    case 1: return toSentenceCase(base)
    case 2: return toTitleCase(base)
    case 3: return toLowerCase(base)
    case 4: return toUpperCase(base)
    case 5: return capitalizeFirst(base)
    default: return base
  }
}
