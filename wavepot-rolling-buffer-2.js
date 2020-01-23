import { editor } from './editor.js'
import { Decimal } from './decimal.mjs'

const settings = {
  bpm: 125,
  sampleRate: 44100
}

// AudioContext initializes after user gesture
let audioContext

let canvas, canvasWorker

let dspFunctions = window.dspFunctions = [] // TODO: place this somewhere more sane?

const tracks = window.tracks = {}

// TODO: move to audioMath.js lib
const normalize = n => n === Infinity || n === -Infinity || isNaN(n) ? 0 : n
const floor = (n, x) =>  n - (n % x)
const ceil = (n, x) => n + (x - (n % x))
const bpmToBeatTime = bpm => 60 / bpm // TODO: is 60 specific to 44100??

// const calcTimes = (startTime, count) => {
//   const currentTime = audioContext.currentTime
//   const currentFrame = currentTime * settings.sampleRate // TODO: sampleRate in times instead of settings?
//   // const prevBeatStopTime = normalize(ceil(currentTime, prevTimes.beatTime))
//   // TODO: maybe ceil? or doesn't matter anymore as long as it is consistent
//   const beatFrames = floor(settings.sampleRate * bpmToBeatTime(settings.bpm), Float32Array.BYTES_PER_ELEMENT)
//   const beatTime = beatFrames / settings.sampleRate
//   const syncTime = ceil(Decimal.add(startTime, Decimal.mul(count, beatTime)).toNumber(), beatTime)
//   return {
//     currentTime,
//     currentFrame,
//     beatTime,
//     beatFrames,
//     syncTime,
//   }
// }

async function setup () {
  const reg = await navigator.serviceWorker.register('./sw.js', { scope: '/' })

  editor.setOption('extraKeys', { // TODO: prevent messing with editor before sw
    'Ctrl-S': cm => playScript(cm.getDoc().getValue()),
    'Ctrl-Enter': cm => {
      Object.keys(tracks).forEach(key => {
        tracks[key].worker.terminate()
        tracks[key].queue
          .filter(source => source.scheduledStart)
          .forEach(source => source.stop())
      })
    }
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
    settings.sampleRate = audioContext.sampleRate
    console.log('start audio:', settings)
  }

  await saveToCache('./settings.js', `export var bpm = ${settings.bpm}; export var sampleRate = ${settings.sampleRate}`)
  await saveToCache('./dsp.js', script)
  const exported = await readExports()

  dspFunctions = window.dspFunctions = []
  const actions = Object.entries(exported).map(async ([key, value]) => {
    switch (value) {
      case 'AsyncFunction':
      case 'Function':
        dspFunctions.push(key)
        setTimeout(() => {
          renderTrack(key)
        }, 400)
        // const label = `${key}`
        // console.time(label)
        // const rendered = await renderBuffer(key)
        // const syncTime = calcSyncTime(rendered)
        // if (prev[key]) prev[key].stop(syncTime)
        // const source = prev[key] = audioContext.createBufferSource()
        // source.loop = true
        // source.buffer = audioContext.createBuffer(1, rendered.blockFrames, audioContext.sampleRate)
        // source.buffer.getChannelData(0).set(new Float32Array(rendered.buffer))
        // source.connect(audioContext.destination)
        // source.start(syncTime)
        // console.timeEnd(label)
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
  Object.keys(tracks).forEach(key => {
    if (!dspFunctions.includes(key)) {
      console.log('halt:', key)
      tracks[key].worker.terminate()
      tracks[key].sources.forEach(source => source.stop())
      delete tracks[key]
    }
  })
  console.log('rendering:', dspFunctions)
  await Promise.all(actions)
  console.log('  ∿ playing ∿')
// setInterval(() => {
//   dspFunctions.forEach((f, i) => {
//     dspFunctions[i] = Math.random()
//   })
//   console.log(dspFunctions)
// }, 1000)
}

async function readExports () {
  const worker = new Worker('./read-exports-worker.js', { type: 'module' })
  return new Promise((resolve, reject) => {
    worker.onmessage = resolve
    worker.onerror = reject
  }).then(({ data }) => (worker.terminate(), data))
}

// TODO: async promise resolve on initial render one time
function renderTrack (methodName) {
  const { bpm, sampleRate } = settings

  // TODO: if dsp fn is the same, do nothing and return here

  let track = tracks[methodName]

  // kill all future track sources that are no longer relevant
  // since we have updated our method
  if (track) {
    clearTimeout(track.pullTimeout)
    track.worker.terminate()
  } else {
    track = tracks[methodName] = {}
  }

  // start worker
  track.worker = new Worker('./worker-rolling-buffer.js', { type: 'module' })

  // frames of one beat
  track.beatFrames = floor(sampleRate * bpmToBeatTime(bpm), Float32Array.BYTES_PER_ELEMENT)

  // beat time in seconds
  track.beatTime = track.beatFrames / sampleRate

//   const syncTime = ceil(Decimal.add(startTime, Decimal.mul(count, beatTime)).toNumber(), beatTime)
  track.syncTime = ceil(audioContext.currentTime, track.beatTime)
  track.syncFrame = track.syncFrame || track.syncTime * sampleRate // TODO: floor?

  console.log('post', track.syncFrame)
  track.worker.postMessage({
    methodName,
    syncTime: track.syncTime,
    syncFrame: track.syncFrame,
    beatTime: track.beatTime,
    beatFrames: track.beatFrames,
  })

  track.worker.onmessage = ({ data: { ready }}) => {
    if (ready === true) {
      track.worker.onmessage = ({ data: { currentFrame, timeToRender, buffer }}) => {
        track.syncFrame = currentFrame
        const source = audioContext.createBufferSource()
        source.connect(audioContext.destination)
        source.buffer = audioContext.createBuffer(1, track.beatFrames, sampleRate)
        source.buffer.getChannelData(0).set(new Float32Array(buffer))
        const currentTime = audioContext.currentTime
        source.syncTime = ceil(currentTime, track.beatTime)
        console.log(currentTime, source.syncTime)
        source.start(source.syncTime)
        track.scheduledSource = source
        track.pullTimeout = setTimeout(() => {
          track.worker.postMessage(true) // pull a buffer
        }, (source.syncTime - currentTime) * 1000)
      }
      track.worker.postMessage(true) // pull a buffer
    } else {
      console.log('not ready?')
    }
  }

  // track.worker.onmessage = ({ data }) => {
  //   // TODO: check if worker failed / was too slow and handle it


  //   track.queue = track.queue.filter(s => s.syncTime > currentTime) // shift played sources
  //   track.queue.push(source)
  //   //source is ready to play, but when?


  //   console.log('sync', track.queue.length, source.syncTime, `(${currentTime})`)
  //   // is 1 track.queue.length
  //   // is 2 track.queue.length
  // }




    // if (buffer.sources.length) {
      // buffer.sources[buffer.sources.length - 1].scheduledStop = source.times.syncTime
      // buffer.sources[buffer.sources.length - 1].stop(source.times.syncTime)
    // }
    // buffer.sources.push(source)

    // source.loop = true // loop until we have next buffer or explicit loop(future)?

    // console.log(buffer)

    // buffer.times = calcTimes(count)
    // const syncTime = buffer.times.dspStartTime

    // // const syncTime = Decimal.add(times.dspStartTime, Decimal.mul(source.count, times.beatTime)).toNumber()
    // console.log(`▶ start ${methodName} (${source.count}) at ${syncTime} [${buffer.sources.length}]`)
    // source.scheduledStart = source.times.syncTime
    // source.start(source.times.syncTime)

    // if (buffer.sources.length > 1) {
    //   console.log(`■ stop ${methodName} (${buffer.sources[0].count}) at ${syncTime} [${buffer.sources.length}]`)
    //   buffer.sources.slice(0, -1).forEach()
    //   buffer.sources.shift().stop(syncTime)
    // }
//  }
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
    rolling buffer
    ok: stop playing immediately when commenting out exports(gtfo)
    consider: underscore prefixed fns behave as "return 0", ie stop at next bar
    stereo when returning array [L,R] (test fn to check result, then branch to mono or stereo)
    sampler/looper/scratcher/sequencers string based on audioworklets
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
  visuals:
    sawtooth-like value |\ for each bar as input value to draw fns (also scale())
    wavepot fancy waveform for each dsp
      (maybe also place it in editor next to fn? or fixed top right in a column)
  thoughts:
    pencil draw to data? maybe a panel with globals&toys:
      bpm, tune, transpose, chord progression, randomize notes on chord progression,
      xy controller, pencil draw, sequencer, camera input with light source for theremin etc
    color console output
*/
