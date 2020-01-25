
/**
 * test
 */

import clip from './lib/softclip/index.js'
import Chorder from './lib/chorder.js'
import Moog from './lib/moogladder/index.js'
import { Sin, Saw, Sqr, Tri } from './lib/wavetable-osc/index.js'
import arp from './lib/arp.js'
import perc from './lib/perc.js'
import slide from './lib/slide.js'
import { scales } from './lib/scales/index.js'
import { dsp as Beats } from './drumbeats.js'
import Delay from './lib/delay/index.js'
import Diode from './lib/diodefilter/index.js'
import { beatFrames, blockFrames } from './settings.js'

export default async () => {
  var notes = scales['mixolydian']

  var chorder = await Chorder({
    notes, reverse: true,
    osc: Saw, params: [256, true],
    octave: 3, speed: 8
  })

  var lpf = Moog('half')
  var lfo = Sin()

  // 101010, 202020, 10010, 10011110, 10110, 333, 33355, 3355, 13551
  // var beats1 = await Beats({ seed: 10110 })
  var beats1 = await Beats({ seed: 10011110 })
  var beats2 = await Beats({ seed: 13551 })

  var diode = new Diode()
  var delay = new Delay(blockFrames)

  return (t, f) => {
    var kick = arp(t, 1/4, 52, 50, 8)

    var keys = chorder(t)
    keys = lpf
      .cut(400 + perc(t%(1/4), 15, 300) + -lfo(1)*200)
      .res(0.75)
      .sat(3.5)
      .update().run(keys)
    keys = perc(t/4%(1/8), 10, keys)

    // var bass = chorder2(t)
    // bass = diode
    //   .cut(.7)
    //   .hpf(.001)
    //   .res(.4)
    //   .run(bass*5)*.4

    var out = (0
    + clip(kick * 1.7, 1)*.8
    + 0.5 * keys
    // + 0.5 * bass
    + beats1(t, f)
    // + beats2(t, f)
    )
    return (
      out
      // delay.feedback(.69).delay(beatFrames/20).run(out, 0.5)
    )
  }
}
