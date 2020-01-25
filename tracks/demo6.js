
/**
 * test
 */

import clip from './lib/softclip/index.js'
import Chorder from './lib/chorder.js'
import Moog from './lib/moogladder/index.js'
import { Sin, Saw, Sqr, Tri } from './lib/wavetable-osc/index.js'
import note from './lib/note/index.js'
import arp from './lib/arp.js'
import perc from './lib/perc.js'
import slide from './lib/slide.js'
import { scales } from './lib/scales/index.js'
import { dsp as Beats } from './drumbeats.js'
import Delay from './lib/delay/index.js'
import Diode from './lib/diodefilter/index.js'
import { beatFrames, blockFrames } from './settings.js'
import rand from './lib/seedable-random.js'

export default async () => {
  rand.seed(555)

  var notes = scales['mixolydian']
  var notesHz = notes
    .map(n => n + (12 + (rand()*2|0) * 12))
    .map(note)

  var chorder = await Chorder({
    notes, reverse: true,
    osc: Saw, params: [256, true],
    octave: 2, speed: 3
  })
  // var chorder2 = await Chorder({ scale: 'mixolydian', reverse: true, osc: Saw, octave: 1, speed: 8, notes: 1 })
  var lpf = Moog('half')
  var lfo = Sin()

  // 101010, 202020, 10010, 10011110, 10110, 333, 33355, 3355, 13551
  var beats1 = await Beats({ seed: 111111, images: [
    // ['base',4,0,.5],
    // ['highs',4,0,.5],
    // ['snare',1,0,.05],
    // ['snare',4,0,.5],
    // ['snare',2,0,.25],
    // ['snare',2,0,.05],
    // ['snare',2,0,.05],
    // ['tonal',2,0,.5],
    // ['tonal',4,0,.45],
  ] })
  // var beats1 = await Beats({ seed: 10011110 })
  var beats2 = await Beats({ seed: 10142, images: [
    ['base',4,0,.5],
    // ['highs',4,0,.5],
    // ['snare',1,0,.05],
    // ['snare',4,0,.5],
    // ['snare',2,0,.25],
    ['snare',4,0,.3],
    // ['snare',2,0,.05],
    // ['tonal',4,0,.5],
    // ['tonal',4,0,.45],
  ]})

  var diode = new Diode()
  var delay = new Delay(blockFrames)

  var bassOsc = Saw(512)

  return (t, f) => {
    var kick = arp(t, 1/4, 52, 50, 8)

    var keys = chorder(t)
    keys = lpf
      .cut(400 + perc(t%(1/4), 15, 300) + -lfo(1)*200)
      .res(0.75)
      .sat(0.8)
      .update().run(keys)
    keys = perc(t/4%(1/8), 10, keys)

    var bass = bassOsc(slide(t, 1/8, 60, notesHz))
    bass = arp(t, 1/16, bass, 34, .59)
    bass = diode
      .cut(1.7)
      .hpf(.01)
      .res(.6)
      .run(bass*10)*10
    bass = clip(bass, .1)

    var out = (0
    // + clip(kick * 1.7, 1)*.6
    + 0.3 * keys
    // + 0.15 * bass
    // + beats1(t, f)
    // + beats2(t, f/2) * .6
    )
    return (
      out
      // delay.feedback(.69).delay(beatFrames/20).run(out, 0.5)
    )
  }
}
