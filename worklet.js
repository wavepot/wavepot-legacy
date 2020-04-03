// use Realtime priority thread in chrome://flags

import * as settings from './settings.js'
import * as dsp from './DSP.js'

const bpm = 125
const beats = 4

let fn = dsp['live'] || (() => (0))
let sample = 0
let channel = null
let i = 0, n = -1
let startSample = 0, endSample = 0
let sampleTime = 0, bufferTime = 0
let startTime = Infinity, endTime = Infinity
let flag = true
let CC = new Int8Array(128).fill(0)

async function init () {
  if (fn.constructor.name === 'AsyncFunction') {
    fn = await fn(settings)
  }

  class DSP extends AudioWorkletProcessor {
    constructor (options) {
      super(options)

      sampleTime = 1 / sampleRate
      bufferTime = sampleTime * 128
      startTime = calcSyncTime()
      console.log('worklet DSP starting at:', startTime)

      this.port.onmessage = e => {
        if (e.data === 'terminate') {
          endTime = calcSyncTime()
          console.log('worklet DSP terminating at:', endTime)
        } else if (e.data.buffer) {
          CC = new Int8Array(e.data.buffer)
        }
      }
    }

    process (inputs, outputs, parameters) {
      if (currentTime + bufferTime >= startTime) {
        startSample = Math.max(0, Math.round((startTime - currentTime) / sampleTime))
        if (n === -1) n = startSample
        channel = outputs[0][0]
        endSample = channel.length
        if (currentTime + bufferTime >= endTime) {
          endSample = 128 - Math.ceil((currentTime + bufferTime - endTime) / sampleTime)
          flag = false
        }
        for (i = startSample; i < endSample; i++, n++) {
          sample = fn(1 + n / settings.beatFrames, CC)
          channel[i] = normalize(sample)
        }
      }
      return flag
    }
  }

  console.log('registering worklet: DSP')
  registerProcessor('DSP', DSP)
}

function calcSyncTime () {
  return normalize(
    currentTime +
    (settings.blockTime -
    (currentTime % (settings.blockTime)))
  )
}

function normalize(number) {
  return number === Infinity || number === -Infinity || isNaN(number) ? 0 : number;
}

init()
