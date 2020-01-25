/**
 * wavepot <3
 *
 * -=- work in progress ;) -=-
 *
 * we are using cutting edge technologies!
 * for it to work, you need to type in the url chrome://flags
 * and enable "Experimental Web Platform features"
 * this will hopefully not be needed in the near future
 * when Chrome releases these into the stable channel
 *
 * uncomment things and edit values below to begin playing
 * ctrl+s saves and plays - ctrl+enter stops
 * go on! hit ctrl+s now!
 * visuals are dwitter.net dweets, copy&paste should work
 * changes are saved locally and preserved in browser cache
 * clear cache or ctrl+z to get back to this initial setup here
 * btw, this is not a sandbox! code below is executed natively
 * in a browser worker - imports work and you can fetch things
 * proper saving and lots more coming up in the near future
 * follow the development here https://github.com/wavepot/wavepot/tree/v3
 * share the love and keep scripting <3
 *
 * enjoy :^)
 */

import * as settings from './settings.js'
import { bpm } from './settings.js'
import rand from './lib/seedable-random.js'
import clip from './lib/softclip/index.js'
import { dsp as R303 } from './tracks/303.js'
import { dsp as Yay } from './tracks/yay.js'
import { dsp as Beats } from './drumbeats.js'
import note from './lib/note/index.js'
import Chords from './lib/chords/index.js'
import { scales } from './lib/scales/index.js'
import chordsOf from './lib/chords-of/index.js'

function arp(t, measure, x, y, z) {
  var ts = t / 4 % measure
  return Math.sin(x * (Math.exp(-ts * y))) * Math.exp(-ts * z)
}

export var dsp = async () => {
  // rand.seed(11.11)
  // rand.seed(202)
  // const chords = chordsOf(scales[Object.keys(scales)[rand()*Object.keys(scales).length|0]])
  // const chords = chordsOf(scales[Object.keys(scales)[rand()*Object.keys(scales).length|0]],3)
  rand.seed(666)
  const chords = chordsOf(scales[Object.keys(scales)[rand()*Object.keys(scales).length|0]],1)
  const c = chords.vii.map(note).map(n => Math.pow(n/4, rand()*5|0))
  // const c = chords.i.map(note).map(n => Math.pow(n/2, rand()*4|0))
  // const c = chords.iii.map(note).map(n => Math.pow(n/4, rand()*5|0))
  // const c = scales['spanish'].map(note).map(n => n**1.45).map(n => Math.pow(n, rand()*1.6|0))
    // .concat(chords.v.map(note).map(n => n * (rand()*2|0)))
    // .concat(chords.v.map(note).map(n => (n**2) * (rand() * 2 | 0)))
  const r303 = await R303({ res: .45, hpf: .0001, melody: c })
  const yay = await Yay(2020)

  // 101010, 202020
  const beats1 = await Beats({ seed: 101010 })
  const beats2 = await Beats({ seed: 202020 })

  return (t, f) => {
    var kick = arp(t, 1/4, 52, 50, 8)

    // mixer
    // return 0 // mute
    return 0.6 * (0
      + kick * .7
      // + clip(kick * 10) * 1.2
      // + r303(t) * 1.6 * arp(t, 1/16, 90, 10, 20)
      + beats1(t, f)
      // + beats2(t, f)
      // + yay(t)
    )
  }
}

// export var draw = t => {
//   // dna
//   for(i=0;i<1100;i++){d=C(t+1*i),s=i==0?2920:9-d*49;x.fillStyle=R(i,i,i,0.1);x.fillRect(S(t*2.5+3*i)*220*S(C(t)+i%50)+960*(i==0?-1:1),i,s,s);}

//   // fire
//   // x.fillRect(0,0,b=2e3,b);for(d=i=999;i--;x.fillRect(e=i%40*50+99*S(i/t)-99,(a=(i*i-t*(99+i%60))%d),a*a/b,50))x.fillStyle=R(i%255,i%150,0,.01)
// }
