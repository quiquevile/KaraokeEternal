import { useState } from 'react'
import { applyCaseStep, CASE_STEP_COUNT } from 'routes/Youtube/components/YouTubeMetadataDialog/caseCycle'

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
    const step = (cycle.step + 1) % CASE_STEP_COUNT
    setCycle({ base: cycle.base, step })
    setValue(applyCaseStep(cycle.base, step))
  }

  return { value, set, cycleCase }
}
