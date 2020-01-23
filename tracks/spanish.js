/**
 *
 * @title got some 303
 * @artist stagas
 * @license mit
 *
 */

import { bpm } from './settings.js'
import clip from './lib/softclip/index.js'
import { dsp as R303 } from './tracks/303.js'
import { dsp as Yay } from './tracks/yay.js'
import rand from './lib/seedable-random.js'
import note from './lib/note/index.js'
import Chords from './lib/chords/index.js'
import { scales } from './lib/scales/index.js'
import chordsOf from './lib/chords-of/index.js'

function arp(t, measure, x, y, z) {
  var ts = t / 4 % measure
  return Math.sin(x * (Math.exp(-ts * y))) * Math.exp(-ts * z)
}

export var dsp = async () => {
  rand.seed(11.11)
  // rand.seed(202)
  // const chords = chordsOf(scales[Object.keys(scales)[rand()*Object.keys(scales).length|0]])
  // const chords = chordsOf(scales[Object.keys(scales)[rand()*Object.keys(scales).length|0]],3)
  // const c = chords.iii.map(note).map(n => Math.pow(n/4, rand()*4|0))
  // rand.seed(666)
  // const chords = chordsOf(scales[Object.keys(scales)[rand()*Object.keys(scales).length|0]],1)
  // const c = chords.i.map(note).map(n => Math.pow(n/4, rand()*4|0))
  // const c = chords.i.map(note).map(n => Math.pow(n/2, rand()*4|0))
  const c = scales['spanish'].map(note).map(n => n**1.45).map(n => Math.pow(n, rand()*1.6|0))
    // .concat(chords.v.map(note).map(n => n * (rand()*2|0)))
    // .concat(chords.v.map(note).map(n => (n**2) * (rand() * 2 | 0)))
  const r303 = await R303({ res: .45, hpf: .0001, melody: c })
  const yay = await Yay(2020)

  return t => {
    var kick = arp(t, 1/4, 48, 50, 8)

    // mixer
    // return 0 // mute
    return 0.6 * (0
      // + kick
      + clip(kick * 10) * 1.2
      + r303(t) * 1.6 //* arp(t, 1/16, 90, 10, 20)
      + yay(t/10)
    )
  }
}

export var drumbeat = async ({ blockFrames }, samples) => {
  const a = blockFrames * 4
  const b = samples[0].length
  return (t, f) => {
    // return 0
    // return clip(samples[0][Math.floor((f + blockFrames) * (b / a))] * 3) * arp(t, 1/16, 900, 10, 20) * 1
    // return clip(samples[0][Math.floor((f + blockFrames) * (b / a))] * 3)
    // return clip(samples[0][Math.floor((f + blockFrames) * (b / a))] * 3) * arp(t, 1/16, 900, 10, 20) * 1
    return clip(samples[0][Math.floor(f * (b / a))] * 3) * arp(t, 1/16, 90, 10, 20) * 1
  }
}

export var draw = t => {
  // dna
  // for(i=0;i<1100;i++){d=C(t+1*i),s=i==0?2920:9-d*49;x.fillStyle=R(i,i,i,0.1);x.fillRect(S(t*2.5+3*i)*220*S(C(t)+i%50)+960*(i==0?-1:1),i,s,s);}

  // fire
  // x.fillRect(0,0,b=2e3,b);for(d=i=999;i--;x.fillRect(e=i%40*50+99*S(i/t)-99,(a=(i*i-t*(99+i%60))%d),a*a/b,50))x.fillStyle=R(i%255,i%150,0,.01)
}
