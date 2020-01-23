import { editor } from './editor.js'
// import './jazz-editor.js'

let canvas, canvasWorker

// AudioContext initializes after user gesture
let audioContext
let dspFunctions = []
// previous source
let prev = {}
//TODO: ^^ improve this - merge dspFunctions/prev?

async function setup () {
  const reg = await navigator.serviceWorker.register('./sw.js', { scope: '/' })

  editor.setOption('extraKeys', { // TODO: prevent messing with editor before sw
    'Ctrl-S': cm => playScript(cm.getDoc().getValue())
  })

  startCanvas()
}

async function saveToCache (filename, content) {
  const headers = { 'Content-Type': 'application/javascript' }
  const req = new Request(filename, { method: 'GET', headers })
  const res = new Response(content, { status: 200, headers })
  const cache = await caches.open('wavepot')
  await cache.put(req, res)
}

async function startCanvas () {
  console.log('start canvas')
  if (canvas) canvas.parentNode.removeChild(canvas)
  canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  document.body.appendChild(canvas)
  const offscreenCanvas = canvas.transferControlToOffscreen()
  canvasWorker = new Worker('./canvas.js', { type: 'module' })
  canvasWorker.onerror = () => canvasWorker = null
  canvasWorker.postMessage({ offscreenCanvas }, [offscreenCanvas])
}

async function playScript (script) {
  console.log("_,-'``'-,_,.-'``") //.-'``'-.,_,.-'``'-.,_,.-")

  if (!audioContext) {
    audioContext = window.audioContext = new AudioContext()
    console.log(`start audio: ${audioContext.sampleRate}hz`)
  }

  const settings = {
    bpm: 60,
    sampleRate: audioContext.sampleRate
  }
  await saveToCache('./settings.js', `export var bpm = ${settings.bpm}; export var sampleRate = ${settings.sampleRate}`)
  await saveToCache('./dsp.js', script)
  const exported = await readExports()

  dspFunctions = []
  const actions = Object.entries(exported).map(async ([key, value]) => {
    switch (value) {
      case 'AsyncFunction':
      case 'Function':
        dspFunctions.push(key)
        const label = `${key}`
        console.time(label)
        const rendered = await renderBuffer(key)
        const syncTime = calcSyncTime(rendered)
        if (prev[key]) prev[key].stop(syncTime)
        const source = prev[key] = audioContext.createBufferSource()
        source.loop = true
        source.buffer = audioContext.createBuffer(1, rendered.blockFrames, audioContext.sampleRate)
        source.buffer.getChannelData(0).set(new Float32Array(rendered.buffer))
        source.connect(audioContext.destination)
        source.start(syncTime)
        console.timeEnd(label)
        break
      case 'String': // TODO: ?
      case 'Number': // TODO: ?
      default:
        if (key === 'draw') {
          if (!canvasWorker) await startCanvas()
          canvasWorker.postMessage({ draw: value })
          break
        }
        console.log('export not handled:', key, value)
    }
  })
  // stop immediately when commenting out what was previously playing
  Object.keys(prev).forEach(key => {
    if (!dspFunctions.includes(key)) {
      console.log('stop:', key)
      prev[key].stop()
      delete prev[key]
    }
  })
  console.log('rendering:', dspFunctions)
  await Promise.all(actions)
  console.log('  ∿ playing ∿')
}

async function readExports () {
  const worker = new Worker('./read-exports-worker.js', { type: 'module' })
  return new Promise((resolve, reject) => {
    worker.onmessage = resolve
    worker.onerror = reject
  }).then(({ data }) => (worker.terminate(), data))
}

async function renderBuffer (methodName) {
  const worker = new Worker('./worker.js', { type: 'module' })
  return new Promise((resolve, reject) => {
    worker.onmessage = resolve
    worker.onerror = reject
    worker.postMessage({ methodName, sampleRate: audioContext.sampleRate })
  }).then(({ data }) => (worker.terminate(), data))
}

function calcSyncTime (rendered) {
  return normalize(
    audioContext.currentTime +
    (rendered.blockTime -
    (audioContext.currentTime % (rendered.blockTime)))
  )
}

function normalize (number) {
  return number === Infinity || number === -Infinity || isNaN(number) ? 0 : number;
}

setup()

/*

- load worker
- master awaits worker for buffer request
- worker integrates with export named 'dsp'
  - future: should expose manual mix
- worker asks master for sharedarraybuffer of size x
  - bpm/buffer size fixed for now, but should be globally configurable
- master receives buffer request, responds with buffer
- worker renders buffer and messages master on completion
>- master places loop buffer on audiocontext in sync (as implemented in wavepot-cli)
- worker exits/master destroys worker
  - future: rolling buffer update as soon as new bars are rendered

- worker sends exports of module to master
  - master runs additional workers for every export and
  - informs each worker which export to play
  !- meta configuration pased this way, bpm, globals?
- export "draw" runs without terminating, until new draw arrives
  - way to differentiate between different function "kinds"?
    - maybe sniffing arguments, fn.toString() or smth

function types so far:
  - rendered loop - make rolling loop asap 1 beat is completed
    - worse case will repeat 2-2 3-3 4-4 etc still "musical"
  - stereo loop?
  - live lowlatency (audioworklet)
    - for keyboard/mouse input manipulation realtime and stuff like that
  - drawing

async instantiation of fns
fn toString() compare and don't update if the same
- we don't give importance to scope, use async for custom scope
  - this avoids the bad pattern of instantiating on import ;)

todo:
  player:
    ok: stop playing immediately when commenting out exports(gtfo)
    consider: underscore prefixed fns behave as "return 0", ie stop at next bar
  editor:
    add match brackets
    add search/replace
    add search + toggle/mute?
  jshint:
    remove missing semicolon warning
    remove leading + warning
    remove unreachable x after return
    remove a leading decimal point be confused with a dot: '.02'
    remove other annoyances
*/
