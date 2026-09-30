/**
 * JSON.parse that never throws: returns the fallback for corrupt input
 * (e.g. a truncated persisted string) instead of crashing the render.
 */
export const parseJSON = <T>(text: string, fallback: T): T => {
  try {
    const parsed: unknown = JSON.parse(text)

    return parsed as T
  } catch {
    return fallback
  }
}

/**
 * Parses a JSON array of queue ids, tolerating corrupt input (and dropping
 * non-numeric entries) instead of crashing the render.
 */
export const parseNumberArray = (text: string): number[] => {
  const parsed = parseJSON<unknown>(text, [])

  return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
}

/**
 * Converts a FormData object into a plain JavaScript object.
 * If a key appears multiple times (e.g., checkboxes or multi-select inputs),
 * it stores them as an array.
 */
export const getFormData = (formData: FormData): Record<string, string | string[]> => {
  const obj: Record<string, string | string[]> = {}

  formData.forEach((value, key) => {
    if (obj[key]) {
      obj[key] = [].concat(obj[key], value as string)
    } else {
      obj[key] = value as string
    }
  })

  return obj
}
