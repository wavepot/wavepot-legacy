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
import Oscillator from '../lib/wavetable-osc/index.js'
import { bpm, sampleRate } from '../settings.js'

var tuning = 440;
var transpose = 12;

function sequence(t, measure, seq){
  return seq[(t / measure / 4 | 0) % seq.length];
}

function slide(t, measure, seq, speed){
  var pos = (t / measure / 4) % seq.length;
  var now = pos | 0;
  var next = now + 1;
  var alpha = pos - now;
  if (next == seq.length) next = 0;
  return seq[now] + ((seq[next] - seq[now]) * Math.pow(alpha, speed));
}

function arp(t, measure, x, y, z){
  var ts = t / 4 % measure;
  return Math.sin(x * (Math.exp(-ts * y))) * Math.exp(-ts * z);
}

var osc = Oscillator('saw', 1024);
var lfo = Oscillator('sin', 512);
var lfo2 = Oscillator('sin', 512);

var Melody = [5, 25, 5, 25, 4, 16, 13, 4 ].map(function(n){
  return note(n + transpose);
})

export var dsp = async ({ res = 0.56, hpf = .0051, melody = Melody } = {}) => {
  var filter = new DiodeFilter()

  filter.res(res)
  filter.hpf(hpf)

  return t => {
    filter.cut(0.001 + ((lfo.play(2.66) * 0.16 + 1) / 2) * (0.258 + lfo2.play(.02) * 0.12))

    var n = slide(t, 1/16, melody, 12)

    var synth_osc = osc.play(n)
    var synth = arp(t, 1/16, synth_osc, 12, 7)

    synth = filter.run(synth * 0.5)
    synth = clip(synth * 12)

    // mixer
    // return 0 // mute
    return 0.6 * synth
  }
}
