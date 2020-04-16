import * as settings from './settings.js'
import * as dsp from './dsp.js'

let timeStart = 0.0, timeElapsed = 0.0
const bpm = 125
const beats = 4

self.onfetch = {}

self.onmessage = async ({ data: { methodName, setup, sampleRate, n }}) => {
  n = n || 1
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

  const context = {
    valueOf () { return this.t },
    n,
    t: n / beatFrames,
    bpm,
    beats,
    beatTime,
    blockTime,
    beatFrames,
    blockFrames,
    sampleRate,
    setup,
  }

  let fn = dsp[methodName]
  if (fn.constructor.name === 'AsyncFunction') {
    timeStart = performance.now()
    fn = await fn(context)
    timeElapsed = performance.now() - timeStart
    console.log('time to prepare:', timeElapsed)
  }

  function run () {
    timeStart = performance.now()

    const buffer = new SharedArrayBuffer(blockFrames * Float32Array.BYTES_PER_ELEMENT)
    const floats = new Float32Array(buffer)

    let sample = fn(context, context.n, floats)

    if (typeof sample === 'number') {
      floats[0] = normalize(sample)
      context.n++

      // we start at i=1 because first sample was captured earlier above
      for (let i = 1; i < blockFrames; i++, context.n++) {
        // TODO: rolling buffer time
        context.t = context.n / beatFrames
        sample = fn(context, context.n)
        floats[i] = normalize(sample)
      }
    } else if (sample instanceof Float32Array) {
      context.n += blockFrames
    } else{
      throw new Error('Unknown sample type: ' + typeof sample)
    }

    // TODO: clean this up, sharedContext ?
    self.postMessage({
      bpm: context.bpm,
      beats: context.beats,
      blockTime: context.blockTime,
      blockFrames: context.blockFrames,
      floats,
      n: context.n
    })

    // TODO: workaround for loop, remove after
    if (methodName !== 'loops') {
      timeElapsed = performance.now() - timeStart
      console.log('time to render:', timeElapsed)
      setTimeout(run, blockTime * 1000 - timeElapsed)
    }
  }

  run()
}

function normalize(number) {
  return number === Infinity || number === -Infinity || isNaN(number) ? 0 : number;
}
