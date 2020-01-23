import * as dsp from './dsp.js'

const normalize = n => n === Infinity || n === -Infinity || isNaN(n) ? 0 : n

self.onmessage = async ({ data: { methodName, syncFrame, beatFrames }}) => {
  let n = syncFrame

  let fn = dsp[methodName]
  if (fn.constructor.name === 'AsyncFunction') {
    fn = await fn() // TODO: better setup params?
  }

  self.onmessage = () => {
    const startTime = performance.now()
    const buffer = new SharedArrayBuffer(beatFrames * Float32Array.BYTES_PER_ELEMENT)
    const floats = new Float32Array(buffer)
    for (let i = 0, t = 0, sample = 0; i < beatFrames; i++, n++) {
      // TODO: maybe floor(n, 4) / (times.beatFrames)???
      t = 1 + n / beatFrames / 2
      // TODO: maybe pass more params and use destructuring? {valueOf} can be t as number for legacy
      sample = fn(t, n)
      floats[i] = normalize(sample) // floats can't handle infinity/NaN values so we zero(0) those
    }
    const timeToRender = (performance.now() - startTime) / 1000 // timeToRender in seconds
    self.postMessage({ currentFrame: n, timeToRender, buffer })
  }

  self.postMessage({ ready: true })
  // function run () { // TODO: maybe run(startTime = performance.now())??


  //   // TODO: if ^ took longer than a beatTime then !!FAIL!!
  //   // because it is slower than we can compute
  //   // else send buffer

  //   bufferedTime += beatTime

  //   // bufferAheadTime += beatTime

  //   console.log('buf', bufferedTime, diffTime, `(${startTime})`)
  //   if (bufferedTime - diffTime < beatTime) { // * 2 means one ahead
  //     run()
  //   } else {
  //     setTimeout(() => {
  //       startTime = performance.now()
  //       run()
  //     }, ((beatTime * 2) - diffTime) * 1000) // back to milliseconds
  //   }
  // }

  // let startTime = performance.now()
  // run()
}
