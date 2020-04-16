import Plot from './lib/plot/index.js'
import arp from './lib/arp.js'
import { sqr, saw, sin, tri, noise } from './lib/osc/index.js'
import { Saw, Noise } from './lib/wavetable-osc/index.js'
import clip from './lib/softclip/index.js'
import note from './lib/note/index.js'
import slide from './lib/slide.js'
import Reverb from './lib/freeverb/index.js'

var bassline = [
  'd#0','d#0','f1','b0',
  'd#0','d#0','f1','b1',
  // 'd#0','d#0','f1','b2',
  // 'd#1','d#1','f4','b3',
  // 'e0','e0','a0','c0',
].map(note)

export var dsp = async ({ blockFrames }) => {
  const plot = Plot(blockFrames, { zoom: 1, height: 20, width: 60 })

  var hihat = 0
  var hihat_delay = Array(100).fill(0)

  var bass = 0
  var bass_delay = Array(60).fill(0)

  var snare = 0
  var snare_delay = Array(60).fill(0)

  var bsaw = Saw(10, true)
  var hnoise = Noise(400, false)

  var reverb = Reverb()
  reverb.room(.05).damp(.3)

  return t => {
    plot()

    var kick = arp(t, 1/4, 38.1, 60, 70)
    plot(kick)

    snare =
      (sqr(t, 130) + noise(t))
      * arp(t/4, 1/8, 100, 2000, 600)
    snare = clip(snare, .012) * .6
    snare = snare + reverb.run(snare * 2.8, 1) * .45
    snare_delay.push(-snare)
    snare_delay.shift()
    // plot(snare)

    hihat =
      hnoise(t)
      * arp(t, 1/16, 10000, 100, 100)

    hihat = clip(hihat, .31)
    hihat =
      hihat * arp(t-1/2, 1/4, 4000, 40, 20)
    // + hihat * arp(t-1/2, 1/16, 1, 70, 20) * .5
    // + hihat * arp(t-1/2+1/8, 1/16, 1, 70, 20) * .1
    // hihat = hihat + reverb.run(hihat*4, 1)
    hihat_delay.push(-hihat)
    hihat_delay.shift()
    // plot(hihat)

    var bass_hz = bassline[Math.floor( (t*4) % 8 )]*2
    // var bass_hz = slide(t, 1/16, 30, bassline)

    bass =
      bsaw(bass_hz)
    // + saw(t, bass_hz*1.004)*2
    // + tri(t, bass_hz)*10
    // + sin(t, bass_hz) //*4.5
    // bass = clip(bass,.4)*.2 //*1.34
    // plot(bass)

    bass = bass * arp(t-1.5, 1/8, .5, 30, 4) * arp(t, 1/16, 1, 1, 2)

    plot(bass)

    bass_delay.push(-bass)
    bass_delay.shift()

    var out = (0
    + kick * .9
    + (0
      + snare
      + snare_delay[20] * .4
      + snare_delay[54] * .8
      ) * .3
    + (0
      + hihat
      + hihat_delay[98] * .9
      - hihat_delay[85] * .1
      // + hihat_delay[94] * 1.5
      // - hihat_delay[50]
      // - hihat_delay[90]
      // + hihat_delay[ Math.floor( (tri(t,.05)+1) * 50 ) ] * .4
       // hihat_delay[ Math.floor( (-tri(t,.1)+1) * 50 ) ] * .4
      ) * .9
    // + (hihat - hihat_delay[0] + hihat_delay[3] + hihat_delay[6]) * .4
    + clip(
      + bass
      - bass_delay[2+Math.floor(t%5)]
      - bass_delay[Math.floor(t%18)]
      // - bass_delay[4]
      // - bass_delay[10]
      - bass_delay[10]
      // - bass_delay[22]
      + bass_delay[48] * .4
      - bass_delay[46]
      - bass_delay[34]
      - bass_delay[44]
      , .5) * .43
    )

    return (0
    + out * .5
    )
  }
}
