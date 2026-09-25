// Ten-band graphic equalizer (VLC-style frequencies) built on
// Web Audio BiquadFilterNodes: shelves at both ends, peaking in between.
export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000]

export const EQ_GAIN_MIN = -12
export const EQ_GAIN_MAX = 12

export function clampEqGain (value: number): number {
  if (!Number.isFinite(value)) return 0

  return Math.min(EQ_GAIN_MAX, Math.max(EQ_GAIN_MIN, value))
}

export interface EqPreset {
  name: string
  gains: number[]
}

export const EQ_PRESETS: EqPreset[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Rock', gains: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5] },
  { name: 'Pop', gains: [3, 4, 4, 2, 0, 0, 1, 2, 3, 4] },
  { name: 'Jazz', gains: [4, 3, 2, 1, 0, 0, 1, 2, 4, 5] },
  { name: 'Classical', gains: [4, 3, 2, 0, -1, -1, 0, 2, 4, 5] },
  { name: 'Dance', gains: [5, 4, 3, 0, 0, 0, 2, 4, 5, 6] },
  { name: 'Vocal', gains: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
]

export function createEqualizer (context: BaseAudioContext): BiquadFilterNode[] {
  return EQ_FREQUENCIES.map((frequency, index) => {
    const filter = context.createBiquadFilter()

    if (index === 0) {
      filter.type = 'lowshelf'
    } else if (index === EQ_FREQUENCIES.length - 1) {
      filter.type = 'highshelf'
    } else {
      filter.type = 'peaking'
      filter.Q.value = 1
    }

    filter.frequency.value = frequency
    filter.gain.value = 0

    return filter
  })
}

export function setEqualizerGains (nodes: BiquadFilterNode[], gains: number[]): void {
  nodes.forEach((node, index) => {
    node.gain.value = clampEqGain(gains[index] ?? 0)
  })
}
