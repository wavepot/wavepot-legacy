/**
 *
 * @title 303
 * @artist stagas
 * @license mit
 *
 */

import note from '../lib/note/index.js'
import DiodeFilter from '../lib/diodefilter/index.js'
import clip from '../lib/softclip/index.js'
import { Ramp, Tri, Saw, Sqr, Sin } from '../lib/wavetable-osc/index.js'
import { bpm, sampleRate, blockFrames } from '../settings.js'
import { dsp as Kick } from './lib/kick.js'
import { dsp as Beats } from './drumbeats.js'
import sequence from './lib/sequence.js'
import slide from './lib/slide.js'
import arp from './lib/arp.js'

var transpose = 12

var osc = Saw(1024)
var lfo = Sin(512)

var Melody = [5, 25, 5, 25, 4, 16, 13, 4].map(function(n){
  return note(n + transpose)
})

export var dsp = async () => {
  var kick = await Kick()
  var beats = await Beats({ images: [
    [2222,'base',4,0,2],
    // [33,'highs',4,0,1],
    // [44,'highs',4,0,1],
    // [33,'snare',2,0,1],
  ] })
  return (t, f) => (0
  + kick(t) * .5
  + beats(t, f % blockFrames) * .5
  )
}

export var live = async ({ res = 0.56, hpf = .0051, melody = Melody } = {}) => {
  var filter = new DiodeFilter()

  filter.res(res)
  filter.hpf(hpf)

  return (t, CC) => {
    filter.cut(
      0.001 +
      // 0.18 + 0.1 * lfo(1/2)
      0.02 + 0.4 * (CC[108] / 127)
    )
    filter.res(0.5 + 0.47 * (CC[127] / 127))

    var n = slide(t, 1/8, 11, melody)

    var synth_osc = osc(n)
    var synth = arp(t, 1/16, synth_osc, 120 - 100 * (CC[109] / 127), 7)

    synth = filter.run(synth * .5)
    synth = clip(synth * 12)

    // mixer
    // return 0 // mute
    return 0.6 * synth
  }
}
