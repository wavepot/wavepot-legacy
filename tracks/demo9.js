
/**
 * test
 */

import clip from './lib/softclip/index.js'
import Chorder from './lib/chorder.js'
import Moog from './lib/moogladder/index.js'
import { saw, sin } from './lib/osc/index.js'
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
  rand.seed(1111)

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
  var sd = 1111
  var beats1 = await Beats({ seed: sd, images: [
    // [sd+3,'base',4,0,.7],
    // [sd+123,'base',8,0,.8],
    [123,'base',4,0,.1],
    [404,'base',1,0,.8],
    // [333,'base',4,0,1],
    // [333,'highs',4,0,.5],
    // [101010,'snare',1,0,.4],
    // [333,'snare',1,0,.4],
    // [sd+44423,'snare',2,0,.7],
    // [445,'texture',2,0,.7],
    // [222,'texture',2,0,.7],
    // [222,'snare',1,0,.7],
    // [223,'snare',4,.2,.7],
    // [555,'snare',1,0,.7],
    // [333,'tonal',8,0,.6],
    // [444,'tonal',4,0,.35],
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

  var bassOsc = Saw(255)
  // var bassOsc = Sqr(50)

  return (t, f) => {
    var kick = arp(t, 1/4, 52, 50, 8)

    var keys = chorder(t)
    keys = lpf
      .cut(400 + perc(t%(1/4), 15, 300) + -lfo(1)*200)
      .res(0.75)
      .sat(0.8)
      .update().run(keys)
    keys = perc(t/4%(1/8), 10, keys)

    var bass = bassOsc(slide(t/2, 1/16, 33, notesHz))
    bass = bass * perc(t%(1/4),30,25) * .17
    // bass = arp(t, 1/16, bass, 70, 40)
    bass = diode
      .cut(1.99 *
       perc((t+(1/2))%(1.5),
       1,.09)
     + sin(t, 4)*.006)
      .hpf(.00014)
      .res(.82)
      .run(bass*2) //* //perc(t%(1/4),2,30) * .52
    // bass = arp(t, 1/16, clip(bass, .5), 20, 30)
    bass = clip(bass, .62)*4
    var out = (0
    // + clip(kick * 1.7, 1)*.9
    // + .7 * keys
    + 0.22 * bass
    + beats1(t, f)
    // + beats2(t, f) * .6
    )
    return (
      out
      // delay.feedback(.69).delay(beatFrames/200).run(out, 0.5)
    )
  }
}
