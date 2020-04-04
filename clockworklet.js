// this processor is needed to kickstart the 'currentTime',
// otherwise things are out of sync

class CLOCK extends AudioWorkletProcessor {
  constructor () {
    super()
    console.log('worklet clock started:', currentTime)
  }

  process () {
    // just exits without any processing
    return false
  }
}

console.log('registering worklet clock')
registerProcessor('CLOCK', CLOCK)
