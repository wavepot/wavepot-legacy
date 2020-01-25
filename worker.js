import * as settings from './settings.js'
import * as dsp from './dsp.js'

const bpm = 125
const beats = 4

self.onfetch = {}

self.onmessage = async ({ data: { methodName, sampleRate, n }}) => {
  n = n || 0
  // this is decodedAudio from the main thread
  // used in conjuction with lib/fetch-sample.js
  // TODO: handle this in a cleaner way
  self.onmessage = ({ data: { fetched }}) => {
    self.onfetch[fetched.url](fetched.sample)
  }

  // math
  const beatTime = 60 / bpm
  const blockTime = beats * beatTime
  const beatFrames = sampleRate * beatTime - ((sampleRate * beatTime) % Float32Array.BYTES_PER_ELEMENT)
  const blockFrames = beatFrames * beats // TODO: subtract here?- ((beatFrames * beats) % 4) // TODO: multiple of 4?

  let fn = dsp[methodName]
  if (fn.constructor.name === 'AsyncFunction') {
    fn = await fn({ blockFrames })
  }

  function run () {
    const buffer = new SharedArrayBuffer(blockFrames * Float32Array.BYTES_PER_ELEMENT)
    const floats = new Float32Array(buffer)

    for (let i = 0, sample = 0; i < blockFrames; i++, n++) {
      // TODO: rolling buffer time
      sample = fn(1 + n / beatFrames, n)
      floats[i] = normalize(sample)
    }

    self.postMessage({
      bpm,
      beats,
      blockTime,
      blockFrames,
      buffer,
      n
    })
    // TODO: workaround for loop, remove after
    if (methodName !== 'loops') {
      setTimeout(run, blockTime * 1000 - 300)
    }
  }

  run()
}

function normalize(number) {
  return number === Infinity || number === -Infinity || isNaN(number) ? 0 : number;
}
