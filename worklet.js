// use Realtime priority thread in chrome://flags

import * as settings from './settings.js'
import * as dsp from './DSP.js'

const bpm = 125
const beats = 4

let fn = dsp['live'] || (() => (0))

let n = 0
let flag = true
let CC = new Int8Array(128).fill(0)

async function init () {
  if (fn.constructor.name === 'AsyncFunction') {
    console.log('is async')
    fn = await fn(settings)
  }

  class DSP extends AudioWorkletProcessor {
    constructor (options) {
      super(options)

      this.port.onmessage = e => {
        console.log(e)
        if (e.data === 'terminate') {
          flag = false
          console.log('should terminate worklet')
        } else if (e.data.buffer) {
          CC = new Int8Array(e.data.buffer)
          console.log('got buffer', CC)
        }
      }
    }

    process (inputs, outputs, parameters) {
      let sample = 0
      const channel = outputs[0][0]
      for (let i = 0; i < channel.length; i++, n++) {
        sample = fn(1 + n / settings.sampleRate, CC)
        channel[i] = normalize(sample)
      }
      return flag
    }
  }

  console.log('registering AudioWorkletProcessor: DSP')
  registerProcessor('DSP', DSP)
}

function normalize(number) {
  return number === Infinity || number === -Infinity || isNaN(number) ? 0 : number;
}

init()
