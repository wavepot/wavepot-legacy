import './threads.js'
const { spawn, Transfer } = threads
import { editor } from './editor.js'

let context
const href = document.location.origin

editor.setOption('extraKeys', {
  'Ctrl-S': cm => {
    const code = cm.getDoc().getValue()
    const script = `
import { mix } from '${document.location.origin}/mix.js'
${code}
`
    play(script, 10 * 44100, 44100)
  }
})

// const code = `
// import noise from 'https://127.0.0.1:8080/noise.js'
// class DSP extends AudioWorkletProcessor {
//   process (inputs, outputs, parameters) {
//     const output = outputs[0]
//     output.forEach(channel => {
//       for (let i = 0; i < channel.length; i++) {
//         channel[i] = noise() //Math.random() * 2 - 1
//       }
//     })
//     return true
//   }
// }
// registerProcessor('DSP', DSP)
// `

async function play (code, length, sampleRate) {
  const source = context.createBufferSource()
  const buffer = await renderBuffer(code, length, sampleRate) //await render(code, 5 * context.sampleRate, context.sampleRate)
  source.buffer = buffer
  // source.loop = true // ?
  source.connect(context.destination)
  source.start() // TODO: find position
}

const foo = { foo: new Float32Array(5000) }
async function renderBuffer (code, length, sampleRate) {
  const context = new OfflineAudioContext(1, length, sampleRate)
  await context.audioWorklet.addModule(`data:text/javascript,${encodeURI(code)}`)
  foo.foo[0] = 10
  const dsp = new AudioWorkletNode(context, 'DSP', { processorOptions: foo })
  const time = dsp.parameters.get('t')
  time.setValueAtTime(3, 0)
  time.linearRampToValueAtTime(13, 10)
  dsp.connect(context.destination)
  const buffer = await context.startRendering()
  return buffer
}

async function startAudioContext () {
  context = new AudioContext()
  console.log(`playback started : ${context.sampleRate}hz`)

  // await context.audioWorklet.addModule(`data:text/javascript,${encodeURI(code)}`)
  // const dsp = new AudioWorkletNode(context, 'DSP')
  // dsp.connect(context.destination)

  document.removeEventListener('click', startAudioContext)
}

// async function startAudioContext () {
//   const context = new AudioContext()
//   console.log('playback started')

//   await context.audioWorklet.addModule(`data:text/javascript,${encodeURI(code)}`)
//   const dsp = new AudioWorkletNode(context, 'DSP')
//   dsp.connect(context.destination)

//   document.removeEventListener('click', startAudioContext)
// }

document.addEventListener('click', startAudioContext)

// document.onclick = async () => {

// const audioContext = new AudioContext()
// await audioContext.audioWorklet.addModule('white-noise-processor.js')
// const whiteNoiseNode = new AudioWorkletNode(audioContext, 'white-noise-processor')
// whiteNoiseNode.connect(audioContext.destination)

// }

var res = new Response('import fn from "./noise.js"; export const foo="hello world"; console.log(fn())', {
  status: 200,
  statusText: 'SuperSmashingGreat!',
  headers: {
    'Content-Type': 'application/javascript'
  }
})

var myInit = {
  method: 'GET',
  headers: {
    'Content-Type': 'application/javascript'
  },
  mode: 'cors',
  cache: 'default'
}

var req = new Request('./foo.js', myInit);

// self.addEventListener('fetch', event => {
//   console.log('fetchinggggg', event)
// })

async function cacheTest () {
  console.log(await caches.keys())
  const cache = await caches.open('v1')
  await cache.put(req, res)
  console.log(await cache.keys())
// console.log('match', await cache.match(req.clone()))
  // const text = await (await fetch(req.clone())).text()
  // const text = await res.text()
  console.log('put in cache')
}


navigator.serviceWorker.register('./sw.js', {scope: '/' })
.then(async (reg) => {
  await cacheTest()
  console.log('Registration succeeded. Scope is ' + reg.scope);
  const { foo } = await import('./foo.js')
  console.log('foo is', foo)
  const mod = await spawn(new Worker('./worker.js', { type: 'module' }))
  const floats = new Float32Array(new SharedArrayBuffer(12))
  const result = await mod.bar(floats.buffer)
  console.log('bar is', result)
  // const f = new Float32Array(result.buffer.send)
  console.log(floats[0])
}).catch((error) => {
  // registration failed
  console.log('Registration failed:', error)
})

