
/**
 * test
 */

import clip from './lib/softclip/index.js'
import Chorder from './lib/chorder.js'
import Moog from './lib/moogladder/index.js'
import { saw } from './lib/osc/index.js'
import { Sin, Saw, Sqr, Tri } from './lib/wavetable-osc/index.js'
import note from './lib/note/index.js'
import arp from './lib/arp.js'
import perc from './lib/perc.js'
import slide from './lib/slide.js'
import { scales } from './lib/scales/index.js'
import { dsp as Beats } from './drumbeats.js'
import Delay from './lib/delay/index.js'
import Diode from './lib/diodefilter/index.js'
import Biquad from './lib/biquad/index.js'
import { beatFrames, blockFrames } from './settings.js'
import rand from './lib/seedable-random.js'

export default async () => {
  rand.seed(666)

  var notes = scales['mixolydian']
  var notesHz = notes
    .map(n => n + (15 + (rand()*4|0) * 12))
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
  var sd = 1111
  var beats1 = await Beats({ seed: sd, images: [
    [sd+3,'base',4,0,.5],
    // [sd+46,'base',4,0,.2],
    // [sd+43392,'base',4,0,.2],
    // [sd,'highs',4,0,.2],
    // [sd,'snare',1,0,.5],
    // [sd+33,'snare',1,0,.4],
    // [sd+44423,'snare',2,0,.7],
    // ['snare',2,0,.5],
    // ['snare',2,0,.5],
    // ['tonal',2,0,.9],
    // ['tonal',4,0,.45],
  ] })
  // var beats1 = await Beats({ seed: 10011110 })
  var beats2 = await Beats({ seed: 10142, images: [
    // ['base',4,0,.5],
    // ['highs',4,0,.5],
    // ['snare',1,0,.05],
    // ['snare',4,0,.5],
    // ['snare',2,0,.25],
    // ['snare',4,0,.3],
    // ['snare',2,0,.05],
    // ['tonal',4,0,.5],
    // ['tonal',4,0,.45],
  ]})

  var diode = new Diode()
  var delay = new Delay(blockFrames)

  // var bassOsc = Saw(512)
  var bassOsc = Sqr(50)

  return (t, f) => {
    var kick = arp(t, 1/4, 52, 50, 8)

    var keys = chorder(t)
    keys = lpf
      .cut(400 + perc(t%(1/4), 15, 300) + -lfo(1)*200)
      .res(0.75)
      .sat(0.8)
      .update().run(keys)
    keys = perc(t/4%(1/8), 10, keys)

    var bass = bassOsc(slide(t/2, 1/16, 7, notesHz))
    bass = bass * perc(t%(1/4),30,15) * .17
    // bass = arp(t, 1/16, bass, 70, 40)
    bass = diode
      .cut(.59 * perc(t%(1/4),10,2.1)) //** (saw(t, 4) * .015)) // + ((saw(t,2.44) * .15 + 1) / 2) * 1.5) // + (arp(t, 1/16, 5, 20, 30)))
      .hpf(.0001)
      .res(.02)
      .run(bass*10) //* //perc(t%(1/4),2,30) * .52
    // bass = arp(t, 1/16, clip(bass, .5), 20, 30)

    var out = (0
    // + clip(kick * 1.7, 1)*1
    // + .7 * keys
    + 0.3 * bass
    // + beats1(t, f)
    // + beats2(t, f) * .6
    )
    return (
      out
      // delay.feedback(.69).delay(beatFrames/200).run(out, 0.5)
    )
  }
}
