import { editor } from './editor.js'
import MIDI from './lib/webmidi/index.js'
import Oscilloscope from './lib/oscilloscope.js'
// import './jazz-editor.js'

let settings = {}

let plots = []

let canvas, canvasWorker

let CC

// AudioContext initializes after user gesture
let audioContext
let audioWorkletNode, audioWorkletProcessorId = -1, workletScript
let dspFunctions = []
// previous source
let prev = {}
//TODO: ^^ improve this - merge dspFunctions/prev?

let setupData = {}, setupCode = ''

async function setup () {
  CC = await MIDI()

  const reg = await navigator.serviceWorker.register('./sw.js', { scope: '/' })

  reg.onupdatefound = () => {
    const sw = reg.installing
    sw.onstatechange = () => {
      console.log('service worker installed - reloading')
      location.reload()
    }
  }

  reg.update()

  if (localStorage.inited === "true") {
    const script = await (await fetch('./dsp.js')).text()
    editor.getDoc().setValue(script)
  }

  workletScript = await (await fetch('./worklet.js')).text()

  editor.setOption('extraKeys', { // TODO: prevent messing with editor before sw
    'Ctrl-S': cm => playScript(cm.getDoc().getValue()),
    'Ctrl-Enter': cm => {
      if (audioWorkletNode) {
        audioWorkletNode.port.postMessage('terminate')
        audioWorkletNode.disconnect()
        audioWorkletNode = null // gc
      }
      Object.keys(prev).forEach(key => {
        if (key === 'live') return
        prev[key].stop()
        prev[key].worker.terminate()
      })
      prev = {}
    }
  })

  // startCanvas()
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

const samples = {}

async function playScript (script) {
  console.log("_,-'``'-,_,.-'``") //.-'``'-.,_,.-'``'-.,_,.-")

  if (!audioContext) {
    audioContext = window.audioContext = new AudioContext({ latencyHint: 'playback' })
    console.log(`start audio: ${audioContext.sampleRate}hz`)

    await audioContext.audioWorklet.addModule('./clockworklet.js')
    audioWorkletNode = new AudioWorkletNode(audioContext, `CLOCK`)
    audioWorkletNode.connect(audioContext.destination)
  }

  // math
  settings = {
    bpm: 125,
    sampleRate: audioContext.sampleRate
  }
  settings.beats = 4
  settings.beatTime = 1 / (settings.bpm / 60)
  settings.blockTime = settings.beats * settings.beatTime
  settings.beatFrames = settings.sampleRate * settings.beatTime - ((settings.sampleRate * settings.beatTime) % Float32Array.BYTES_PER_ELEMENT)
  settings.blockFrames = settings.beatFrames * settings.beats // TODO: subtract here?- ((beatFrames * beats) % 4) // TODO: multiple of 4?

  await saveToCache('./settings.js', `
    export var bpm = ${settings.bpm}
    export var sampleRate = ${settings.sampleRate}
    export var beats = ${settings.beats}
    export var beatTime = ${settings.beatTime}
    export var blockTime = ${settings.blockTime}
    export var beatFrames = ${settings.beatFrames}
    export var blockFrames = ${settings.blockFrames}
  `)
  await saveToCache('./dsp.js', script)
  await saveToCache(`./DSP${++audioWorkletProcessorId}.js`, script)
  await saveToCache(`./worklet${audioWorkletProcessorId}.js`, workletScript.replace(/DSP/g, `DSP${audioWorkletProcessorId}`))
  const exported = await readExports()

  localStorage.inited = "true"

  if (exported.setup && setupCode !== exported.setup) {
    console.log('running setup')
    setupCode = exported.setup
    setupData = await setupWorker()
  }

  delete exported.setup

  dspFunctions = []
  const actions = Object.entries(exported).map(async ([key, value]) => {
    switch (value) {
      case 'AsyncFunction':
      case 'Function':
        dspFunctions.push(key)
        const label = `${key}`
        console.time(label)
        const rendered = await renderBuffer(key)
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
      if (key === 'live') {
        audioWorkletNode.port.postMessage('terminate')
        audioWorkletNode = null // gc
        delete prev['live']
        return
      }
      const syncTime = calcSyncTime(settings)
      console.log('stop', key, 'at:', syncTime)
      prev[key].worker.terminate()
      prev[key].stop(syncTime)
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

async function setupWorker () {
  const worker = new Worker('./setup-worker.js', { type: 'module' })
  return new Promise((resolve, reject) => {
    worker.onmessage = async ({ data }) => {
      if (data.fetch) {
        const uri = '.' === data.fetch[0]
          ? data.fetch.split('/').slice(1,-1).join('/') + '/' + encodeURIComponent(data.fetch.split('/').pop())
          : data.fetch
        const sample = samples[data.fetch] || (await audioContext.decodeAudioData(await (await fetch(uri)).arrayBuffer())).getChannelData(0) //'./samples/RAW_DDT_JAK_D.wav'
        samples[data.fetch] = sample
        worker.postMessage({ fetched: { url: data.fetch, sample }})
      } else {
        resolve({ data })
      }
    }
    worker.onerror = reject
  }).then(({ data }) => (worker.terminate(), data))
}

async function renderBuffer (methodName) {
  // audioworklet dsp
  if (methodName === 'live') {
    console.log(`should load module worklet${audioWorkletProcessorId}.js`)
    await audioContext.audioWorklet.addModule(`./worklet${audioWorkletProcessorId}.js`)
    let prevNode = prev['live'] = audioWorkletNode
    // TODO: pass time parameter (n) to node
    // for proper alignment of waveforms
    // otherwise clicks will be audible
    // new AudioWorkletNode(audioContext, 'DSP', { processorOptions: { n } }
    audioWorkletNode = new AudioWorkletNode(audioContext, `DSP${audioWorkletProcessorId}`)
    audioWorkletNode.port.postMessage({ buffer: CC.buffer })
    if (prevNode) {
      prevNode.port.postMessage('terminate')
      // prevNode.disconnect()
      prevNode = null // gc
    }
    audioWorkletNode.connect(audioContext.destination)
    return audioWorkletNode
  } else { // regular block dsp
    const worker = new Worker('./worker.js', { type: 'module' })
    return new Promise((resolve, reject) => {
      plots.forEach(p => p.widget.clear())
      plots = []
      let resolved = false
      const timeStart = performance.now()
      worker.onmessage = async ({ data }) => {
        // console.log('message', data)
        if (data.fetch) {
          const uri = '.' === data.fetch[0]
            ? data.fetch.split('/').slice(1,-1).join('/') + '/' + encodeURIComponent(data.fetch.split('/').pop())
            : data.fetch
          const sample = samples[data.fetch] || (await audioContext.decodeAudioData(await (await fetch(uri)).arrayBuffer())).getChannelData(0) //'./samples/RAW_DDT_JAK_D.wav'
          samples[data.fetch] = sample
          worker.postMessage({ fetched: { url: data.fetch, sample }})
        } else if (data.plot) {
          const os = new Oscilloscope({ ...data.plot.opts, height: editor.defaultTextHeight() })
          plots.push(data.plot)
          data.plot.os = os
          os.render(new Float32Array(data.plot.buffer))
          os.event = () => {
            plots.forEach(p => {
              p.os.zoom = os.zoom
              p.os.render()
            })
          }
          const line = editor.getLineHandle(data.plot.pos.line)
          os.el.style.left = editor.charCoords({ line: data.plot.pos.line, ch: line.text.length }).left + 2 + 'px'
          data.plot.widget = editor.addLineWidget(data.plot.pos.line, os.el, { above: true, coverGutter: true })
        } else {
          const key = methodName
          const timeElapsed = (performance.now() - timeStart) / 1000
          const renderTime = prev[key] ? prev[key].renderTime : timeElapsed
          const renderAverageTime = timeElapsed
          const syncTime = calcSyncTime(data)
          if (prev[key]) {
            if (!resolved) prev[key].worker.terminate()
            prev[key].stop(syncTime)
          }
          const source = prev[key] = audioContext.createBufferSource()
          source.n = data.n
          source.worker = worker
          source.loop = true
          source.buffer = audioContext.createBuffer(1, data.blockFrames, audioContext.sampleRate)
          source.buffer.getChannelData(0).set(data.floats)
          source.connect(audioContext.destination)
          source.start(syncTime)
          source.syncTime = syncTime
          source.renderTime = renderTime
          source.renderAverageTime = renderAverageTime

          if (!resolved) {
            resolved = true
            resolve({ data })
          }

          // TODO: workaround for loops, remove this
          if (key === 'loops') {
            worker.terminate()
          }
        }
      }
      worker.onerror = reject
      worker.postMessage({
        methodName,
        setup: setupData,
        sampleRate: audioContext.sampleRate,
        n: prev[methodName]
          ? prev[methodName].n
          + (audioContext.currentTime + prev[methodName].renderTime
            > prev[methodName].syncTime + prev[methodName].renderAverageTime
            ? settings.blockFrames
            : 0)
          : 0
      })
    }) //.then(({ data }) => (worker.terminate(), data))
  }
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
