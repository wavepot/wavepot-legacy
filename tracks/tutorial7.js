import Plot from './lib/plot/index.js'
import arp from './lib/arp.js'
import envelope from './lib/envelope/index.js'
import { sqr, saw, sin, tri, noise } from './lib/osc/index.js'
import { Sin, Saw, Noise } from './lib/wavetable-osc/index.js'
import clip from './lib/softclip/index.js'
import note from './lib/note/index.js'
import slide from './lib/slide.js'
import Glitch from './lib/glitch.js'
import fetchSample from './lib/fetch-sample.js'
import tapeIt from './lib/tape-it.js'
import convolve from './convolve3.js'
import resample from './lib/resample.js'
import Delay from './lib/delay/index.js'

var bassline = [
  'c1','c1','f#1','b0',
  'c1','c1','f#1','b0',
  // 'd#0','d#0','f1','b2',
  // 'd#1','d#1','f4','b3',
  // 'e0','e0','a0','c0',
].map(note)//.reverse()

export var setup = async ({ blockFrames }) => {
  var vocal = await fetchSample('http://ccmixter.org/content/MissJudged/MissJudged_-_The_World_Ends.mp3')

  // var impulse = await fetchSample('./impulses/200-R1_Reverb1.wav')
  var hall_impulse = await fetchSample('./impulses/220-R2_Reverb2.wav')
  // var impulse = await fetchSample('./impulses/223-R2_Strings.wav')
  // var impulse = await fetchSample('./impulses/301-LargeHall.wav')
  // var impulse = await fetchSample('./impulses/302-SmallHall.wav')
  // var impulse = await fetchSample('./impulses/303-Strings.wav')
  // var impulse = await fetchSample('./impulses/304-PianoHall.wav')
  // var impulse = await fetchSample('./impulses/305-OrchRoom.wav')
  var room_impulse = await fetchSample('./impulses/307-MediumRm.wav')
  // var impulse = await fetchSample('./impulses/313-RoomAmb.wav')
  // var impulse = await fetchSample('./impulses/315-LongCave.wav')

  var room = {
    kernel: convolve.fftProcessKernel(blockFrames, room_impulse),
    length: room_impulse.length
  }

  var hall = {
    kernel: convolve.fftProcessKernel(blockFrames, hall_impulse),
    length: hall_impulse.length
  }

  return {
    delay_1: new Float32Array(new SharedArrayBuffer(blockFrames * 4)),
    vocal,
    room,
    hall,
  }
}

export var dsp = async (context) => {
  var {
    setup,
    blockFrames,
    beatFrames,
    sampleRate,
    n
  } = context

  var plot = Plot(blockFrames, { zoom: 1, height: 20, width: 60 })

  var room_reverb = convolve.fftConvolution(blockFrames, setup.room.kernel, setup.room.length)
  var hall_reverb = convolve.fftConvolution(blockFrames, setup.hall.kernel, setup.hall.length)

  var vocal = setup.vocal

  var { reverse, stutter, vinyl } = Glitch(context)

  var kick_mute = false

  var hihat = 0
  var hihat_osc = Noise(5000, true)
  var hihat_delay = Array(100).fill(0)

  var bass = 0
  var bass_osc = Saw(12, true)
  var bass_delay = Array(60).fill(0)

  var snare = 0
  var snare_osc = Noise(5000, true)
  var snare_delay = Array(60).fill(0)

  var reverb_amount = .08

  var hiss = await Hiss(context)

  var delay = Delay(blockFrames)
  delay.buffer = setup.delay_1

  var mix = (t, n, floats) => {
    plot()

    var kick =
      + (arp(t, 1/4, 50.94, 60, 40)
      + arp(t, 1/4, 32.9, 60, 30))
      * envelope(t, 1/4, 48, 52, 1)
    kick = clip(kick, .33)
    // plot(kick)

    snare =
      + tri(t, bassline[2] + sin(t, 150) * .00007) * 3
      + tri(t, bassline[2]*4 + sin(t, 150) * .0004) * 2.3
    snare *= arp(t, 1/4, 1310, 4, 4) * .6
    snare += snare_osc(5.2) * 2.5
    snare =
      + snare * envelope(t, 1/2, 13, 10, 10)
      + snare * envelope(t, 1/2, 20, 20, 30) * .6
      + snare * envelope(t, 1/2, 50, 20, 30) * 1.4
    snare *= .12
    snare_delay.push(-snare)
    snare_delay.shift()
    // plot(snare)

    hihat = hihat_osc(1)
    hihat *= arp(t, 1/16, 10000, 100, 100)
    hihat = clip(hihat, .31)
    hihat *= arp(t-1/2, 1/4, 4000, 40, 20)
    hihat_delay.push(-hihat)
    hihat_delay.shift()
    // plot(hihat)

    var bass_hz = bassline[Math.floor( (t*4) % 8 )]*2
    // var bass_hz = slide(t, 1/16, 30, bassline)

    bass = bass_synth(t, bass_hz)
    // bass = clip(bass,.4)*2 //*1.34
    // plot(bass)

    bass_delay.push(-bass)
    bass_delay.shift()

    var out =
    (0
    + !kick_mute * (0
      + kick
      ) * .42

    + (0
      + snare
      + snare_delay[55] * .7
      + snare_delay[14] * .3
      ) * .07

    + (0
      + hihat
      + hihat_delay[98] * .9
      - hihat_delay[85] * .2
      ) * .07

    + clip(0
      + bass
      - bass_delay[2+Math.floor(t%5)]
      - bass_delay[Math.floor(t%18)]
      + bass_delay[56] * .7
      // - bass_delay[10]
      - bass_delay[22] * .2
      + bass_delay[48] * .4
      // - bass_delay[46]
      // - bass_delay[34]
      // - bass_delay[44]
      , .18) * .13
    )

    var vocals = resample(n, vocal, 30, 0)

    var vocals_delay = delay
      .feedback(.95)
      .delay(Math.floor((1/[2,2,2,3,4,16,32,64][Math.floor((t/2)%8)]) * blockFrames))
      .run(0)
      // .run(vocals)

    out = (0
      + out * .5
      + vocals * .4
      + vocals_delay * .3
      // + resample(n, vocal, 25, 0) * .4
      // + hiss(t, n, floats)
    )

    return out
  }

  var bass_synth = (t, hz) => {
    hz *= 1
    var out = (
      + bass_osc(hz) * .78
      // + saw(t, hz*1.6) * .33
      // + saw(t, hz*1.004) * .42
      // + saw(t, hz/2) * .62
      // + sin(t, hz) * .3
    )
    out = out * (arp(t-1.5, 1/16, .5, 30 + sin(t, .05) * 20, 4) * arp(t-1.5, 1/4, 2, 6, 2))
    return out
  }

  // kick_mute = true
  // reverb_amount = 0.8

  var outMix =
    mix
    // reverse(mix)
    // vinyl(mix)
    // stutter(mix, 16, true)

  return (t, n, floats) => {
    var out = tapeIt(outMix, context)
    var r1 = room_reverb(out).slice(1800,1800+blockFrames)
    var r2 = hall_reverb(out).slice(4000,4000+blockFrames)
    for (var i = 0; i < blockFrames; i++) {
      floats[i] = (
        + out[i] * .75
        + r1[i] * .25
        + r2[i] * reverb_amount
      )
    }
    return floats
  }
}

var Hiss = async ({ blockFrames }) => {
  var f = 0
  var hiss = 0
  var hiss_delay = Array(100).fill(0)

  return (t, n, floats) => {
    f++

    hiss = noise()
    hiss_delay.push(-hiss)
    hiss_delay.shift()

    return (
    + (f <= blockFrames * 8) ? 1 : 0)*(0
      + hiss * .7
      + hiss_delay[98] * .7
      ) * (.05 * (1 - (f / (8 * blockFrames))))
  }
}
