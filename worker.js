import * as settings from './settings.js'
import * as dsp from './dsp.js'

const bpm = 125
const beats = 4

self.onmessage = async ({ data: { methodName, sampleRate }}) => {
  // math
  const beatTime = 1 / (bpm / 60)
  const blockTime = beats * beatTime
  const beatFrames = sampleRate * beatTime - ((sampleRate * beatTime) % Float32Array.BYTES_PER_ELEMENT)
  const blockFrames = beatFrames * beats // TODO: subtract here?- ((beatFrames * beats) % 4) // TODO: multiple of 4?

  const buffer = new SharedArrayBuffer(blockFrames * Float32Array.BYTES_PER_ELEMENT)
  const floats = new Float32Array(buffer)
  let fn = dsp[methodName]
  if (fn.constructor.name === 'AsyncFunction') {
    fn = await fn(settings)
  }
  for (let i = 0, sample = 0; i < blockFrames; i++) {
    // TODO: rolling buffer time
    sample = fn(1 + i / beatFrames, i)
    floats[i] = normalize(sample)
  }

  self.postMessage({
    bpm,
    beats,
    blockTime,
    blockFrames,
    buffer
  })
}

function normalize(number) {
  return number === Infinity || number === -Infinity || isNaN(number) ? 0 : number;
}
