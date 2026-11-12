/**
 * Whether the player should download and measure a queued song on the spot.
 *
 * Lives apart from the hook so the decision -- gated only by the room's own
 * ReplayGain toggle, never by a per-account preference -- stays covered by
 * plain unit tests.
 */

export interface NeedsGainAnalysisInput {
  /** the room's per-player toggle, not any account-level preference */
  isReplayGainEnabled: boolean
  mediaId: number | null
  /** null means the song has never been measured */
  rgTrackGain: number | null
  rgTrackPeak: number | null
}

/** True when the song still needs a first-play measurement. `hasFailed` is
 * consulted last and only then, so a disabled toggle or a stored value never
 * reaches it. */
export function needsGainAnalysis (
  { isReplayGainEnabled, mediaId, rgTrackGain, rgTrackPeak }: NeedsGainAnalysisInput,
  hasFailed: (mediaId: number) => boolean,
): boolean {
  return isReplayGainEnabled
    && mediaId !== null
    && (rgTrackGain === null || rgTrackPeak === null)
    && !hasFailed(mediaId)
}
