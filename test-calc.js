import { Decimal } from './decimal.mjs'

const audioContext = {
  currentTime: 0,
}
const settings = {
  bpm: 125,
  sampleRate: 44100,
}
const normalize = n => n === Infinity || n === -Infinity || isNaN(n) ? 0 : n
const floor = (n, x) =>  n - (n % x)
const ceil = (n, x) => n + (x - (n % x))
const bpmToBeatTime = bpm => 60 / bpm // TODO: is 60 specific to 44100??
const calcTimes = count => {
  const currentTime = audioContext.currentTime
  const currentFrame = currentTime * settings.sampleRate // TODO: sampleRate in times instead of settings?
  // const prevBeatStopTime = normalize(ceil(currentTime, prevTimes.beatTime))
  // TODO: maybe ceil? or doesn't matter anymore as long as it is consistent
  const beatFrames = floor(settings.sampleRate * bpmToBeatTime(settings.bpm), Float32Array.BYTES_PER_ELEMENT)
  const beatTime = beatFrames / settings.sampleRate
  const dspStartTime = ceil(Decimal.add(currentTime, Decimal.mul(count, beatTime)).toNumber(), beatTime)
  return {
    currentTime,
    currentFrame,
    beatTime,
    beatFrames,
    dspStartTime,
  }
}

describe('test audio calc', () => {
  it('should be synced', () => {
    console.log(calcTimes(0))
    console.log(calcTimes(1))
    console.log(calcTimes(2))
    console.log(calcTimes(3))
  })
})