import { useState } from 'react'
import { nextCaseStep } from 'routes/Youtube/components/YouTubeMetadataDialog/caseCycle'

export interface CaseField {
  value: string
  set: (nextValue: string) => void
  cycleCase: () => void
}

export const useCaseField = (initial: string): CaseField => {
  const [value, setValue] = useState(initial)
  const [cycle, setCycle] = useState({ base: initial, step: 0 })

  // manual edits (and swaps) reset the cycle with the new text as base
  const set = (nextValue: string) => {
    setValue(nextValue)
    setCycle({ base: nextValue, step: 0 })
  }

  const cycleCase = () => {
    const next = nextCaseStep(cycle.base, cycle.step, value)
    setCycle({ base: cycle.base, step: next.step })
    setValue(next.value)
  }

  return { value, set, cycleCase }
}
