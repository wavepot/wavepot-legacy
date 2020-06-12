import powerRange from '../lib/power-range.js'

export default class LoopBuffer {
  constructor ({ audioContext, numberOfChannels, numberOfBars, sampleRate, barLength }) {
    this.audioContext = audioContext
    this.numberOfChannels = numberOfChannels
    this.numberOfBars = numberOfBars
    this.sampleRate = sampleRate
    this.barLength = barLength
    this.audioBuffer = this.audioContext.createBuffer(
      numberOfChannels,
      barLength * numberOfBars,
      sampleRate
    )
    this.sharedBuffer = Array(numberOfChannels).fill().map(() =>
      new SharedArrayBuffer(
        barLength * numberOfBars * Float32Array.BYTES_PER_ELEMENT
      )
    )
    this.barArrays = Array(numberOfBars).fill().map((_, barIndex) => {
      const barArray = Array(numberOfChannels).fill().map((_, channelIndex) =>
        new Float32Array(this.sharedBuffer[channelIndex], barIndex * barLength * 4, barLength)
      )
      barArray.barIndex = barIndex
      barArray.byteOffset = barIndex * barLength
      barArray.loopPoints = {
        loopStart: (barIndex * barLength) / sampleRate,
        loopEnd: ((barIndex + 1) * barLength) / sampleRate
      }
      return barArray
    })
    this.written = 0
    this.reset()
  }

  get isFull () {
    return this.written === this.numberOfBars
  }

  reset () {
    this.bufferSource = null
    this.initialBarIndex = -1
    this.currentBarIndex = -1
    this.currentBarArray = null
  }

  start (time) {
    this.bufferSource.start(time)
  }

  stop (time) {
    this.bufferSource.stop(time)
  }

  connect (destination) {
    this.bufferSource = this.audioContext.createBufferSource()
    this.bufferSource.loop = true
    this.bufferSource.buffer = this.audioBuffer
    this.bufferSource.connect(destination)
    this.bufferSource.onended = () => {
      this.bufferSource.disconnect()
      this.reset()
      this.onended()
    }
    this.initialBarIndex = this.currentBarArray.barIndex
    Object.assign(this.bufferSource, this.currentBarArray.loopPoints)
  }

  // after this call, currentBarArray is ready to be passed to the worker
  setBarIndex (barIndex) {
    this.currentBarIndex = barIndex
    this.currentBarArray = this.barArrays[barIndex]
  }

  // when worker fills shared array with data, copy segment to audio source
  commitCurrentArray () {
    for (const [channelIndex, barArrayChannel] of this.currentBarArray.entries()) {
      this.audioBuffer.getChannelData(channelIndex).set(barArrayChannel, this.currentBarArray.byteOffset)
    }
    // if we haven't done a full circle, advance loop range to the highest power of 2
    if (!this.isFull) {
      const indexRange = powerRange([this.initialBarIndex, this.currentBarIndex], this.barArrays.length)
      this.bufferSource.loopStart = this.barArrays[indexRange[0]].loopPoints.loopStart
      this.bufferSource.loopEnd = this.barArrays[indexRange[1]].loopPoints.loopEnd
      this.written++
    }
    // advance bar to next bar index
    this.setBarIndex((this.currentBarIndex + 1) % this.barArrays.length)
  }
}
