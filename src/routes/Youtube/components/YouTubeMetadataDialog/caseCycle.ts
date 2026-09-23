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

/**
 * Next case step whose output differs from the current text, so a press
 * always shows a visible change. Skips forms identical to the current
 * one (e.g. uppercasing an already uppercase text). When every form is
 * identical (e.g. no cased characters), just advances the step.
 */
export function nextCaseStep (base: string, step: number, current: string): { step: number, value: string } {
  for (let i = 1; i <= CASE_STEP_COUNT; i++) {
    const next = (step + i) % CASE_STEP_COUNT
    const value = applyCaseStep(base, next)

    if (value !== current) return { step: next, value }
  }

  return { step: (step + 1) % CASE_STEP_COUNT, value: current }
}
