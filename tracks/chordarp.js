
/**
 * test
 */

import Chorder from './lib/chorder.js'
import Moog from './lib/moogladder/index.js'
import { Sin, Saw, Sqr, Tri } from './lib/wavetable-osc/index.js'
import perc from './lib/perc.js'

export default async () => {
  var chorder = await Chorder({ scale: 'minor', osc: Saw, octave: 3, speed: 4 })
  var lpf = Moog('half')
  var lfo = Sin()

  return t => {
    return perc(
      t/4%(1/8), 10,
      lpf.cut(400 + perc(t%(1/4), 15, 300) + -lfo(3)*200).res(0.75).sat(3.5)
      .update().run(chorder(t)))
  }
}
