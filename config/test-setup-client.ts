// Minimal Web Audio stub so client modules whose audio classes extend
// browser-only globals (e.g. SoundTouchNode extends AudioWorkletNode)
// can be imported in the node test environment. Never instantiated there.
export {}

if (typeof globalThis.AudioWorkletNode === 'undefined') {
  globalThis.AudioWorkletNode = class AudioWorkletNode {}
}
