// Vitest stand-in for the webpack `asset/source` import of the audio
// worklet processor: the real processor script must never execute in the
// node test environment (it extends AudioWorkletProcessor).
export default '// soundtouch processor stub for tests'
