
/**
 * test
 */

import Chorder from './lib/chorder.js'
import Moog from './lib/moogladder/index.js'
import { Sin, Saw, Sqr, Tri } from './lib/wavetable-osc/index.js'
import arp from './lib/arp.js'
import perc from './lib/perc.js'
import { dsp as Beats } from './drumbeats.js'

export default async () => {
  var chorder = await Chorder({ scale: 'mixolydian', reverse: true, osc: Saw, octave: 2, speed: 8 })
  var lpf = Moog('half')
  var lfo = Sin()

  // 101010, 202020, 10010, 10011110, 10110, 333, 33355, 3355, 13551
  // var beats1 = await Beats({ seed: 10110 })
  // var beats1 = await Beats({ seed: 10011110 })

  var beats2 = await Beats({ seed: 13551 })

  return (t, f) => {
    var kick = arp(t, 1/4, 52, 50, 8)
    return (0
    + kick * .7
    + perc(
        t/4%(1/8), 10,
        lpf.cut(400 + perc(t%(1/4), 15, 300) + -lfo(1)*200).res(0.75).sat(3.5)
        .update().run(chorder(t))) * .5
    // + beats1(t, f)
    + beats2(t, f)
    )
  }
}
