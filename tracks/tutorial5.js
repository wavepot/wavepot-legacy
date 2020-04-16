import Plot from './lib/plot/index.js'
import arp from './lib/arp.js'
import envelope from './lib/envelope/index.js'
import { sqr, saw, sin, tri, noise } from './lib/osc/index.js'
import { Sin, Saw, Noise } from './lib/wavetable-osc/index.js'
import clip from './lib/softclip/index.js'
import note from './lib/note/index.js'
import slide from './lib/slide.js'
import Reverb from './lib/freeverb/index.js'
import Glitch from './lib/glitch.js'

var bassline = [
  'c1','c1','f#1','b0',
  'c1','c1','f#1','b0',
  // 'd#0','d#0','f1','b2',
  // 'd#1','d#1','f4','b3',
  // 'e0','e0','a0','c0',
].map(note)

export var dsp = async (context) => {
  var {
    blockFrames,
    beatFrames,
    sampleRate,
    n
  } = context

  var plot = Plot(blockFrames, { zoom: 1, height: 20, width: 60 })

  var { reverse, stutter, vinyl } = Glitch(context)

  var hihat = 0
  var hihat_delay = Array(100).fill(0)

  var bass = 0
  var bass_delay = Array(60).fill(0)

  var snare = 0
  var snoise = Noise(5000, true)
  var snare_delay = Array(60).fill(0)

  var bsaw = Saw(12, true)
  var hnoise = Noise(5000, true)

  var reverb = Reverb()
  reverb.room(.12).damp(.80)

  var fn = t => {
    plot()

    var kick =
      (arp(t, 1/4, 50.94, 60, 40)
    + arp(t, 1/4, 32.9, 60, 30))
    * envelope(t, 1/4, 48, 52, 1)
    kick = clip(kick, .33)
    // plot(kick)

    snare =
      tri(t, bassline[2] + sin(t, 150) * .00007) * 3
    + tri(t, bassline[2]*4 + sin(t, 150) * .0004) * 2.3
    snare *= arp(t, 1/4, 1310, 4, 4) * .6
    snare += snoise(5.2) * 2.5
    snare =
      snare * envelope(t, 1/2, 13, 10, 10)
    + snare * envelope(t, 1/2, 20, 20, 30) * .6
    + snare * envelope(t, 1/2, 50, 20, 30) * 1.4
    snare *= .12
    snare_delay.push(-snare)
    snare_delay.shift()
    // plot(snare)

    hihat = hnoise(10)
    hihat *= arp(t, 1/16, 10000, 100, 100)
    hihat = clip(hihat, .31)
    hihat *= arp(t-1/2, 1/4, 4000, 40, 20)
    hihat_delay.push(-hihat)
    hihat_delay.shift()
    // plot(hihat)

    var bass_hz = bassline[Math.floor( (t*4) % 8 )]*2
    // var bass_hz = slide(t, 1/16, 30, bassline)

    bass =
      bsaw(bass_hz) * .78
    // + saw(t, bass_hz*1.6) * .33
    // + saw(t, bass_hz*1.004) * .42
    // + saw(t, bass_hz/2)*.62
    // + sin(t, bass_hz) * .3
    // bass = clip(bass,.4)*.2 //*1.34
    // plot(bass)

    bass = bass * arp(t-1.5, 1/16, .5, 30, 4) * arp(t-1.5, 1/4, 2, 6, 2)
    // plot(bass)

    bass_delay.push(-bass)
    bass_delay.shift()

    var out =
    (0
    + (0
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

    return (0
    + out * .5
    )
  }

  return (
    fn
    // reverse(fn)
    // vinyl(fn)
    // stutter(fn, 32, true)
    // stutter(32, [0, 20000, 12000, 4000, 9000, 14000, 22000])
  )
}
