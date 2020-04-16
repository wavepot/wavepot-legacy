import Plot from './lib/plot/index.js'
import arp from './lib/arp.js'
import { sqr, saw, sin, tri, noise } from './lib/osc/index.js'
import { Saw } from './lib/wavetable-osc/index.js'
import clip from './lib/softclip/index.js'
import note from './lib/note/index.js'
import slide from './lib/slide.js'

var bassline = [
  'd#0','d#0','f1','b0',
  'd#1','d#1','f2','b1',
  'd#0','d#0','f1','b2',
  'd#1','d#1','f4','b3',
  // 'e0','e0','a0','c0',
].map(note)

export var dsp = async ({ blockFrames }) => {
  const plot = Plot(blockFrames, { zoom: 1, height: 20, width: 60 })

  var hihat = 0
  var hihat_delay = Array(7).fill(0)

  var bass = 0
  var bass_delay = Array(60).fill(0)

  var bsaw = Saw(10, false)

  return t => {
    plot()

    var kick = arp(t, 1/4, 38, 60, 40)
    plot(kick)

    var snare =
      (sqr(t/4, 230) + noise(t/4))
      * arp(t/4, 1/8, 100, 150, 900)
    snare = clip(snare, .07)
    // plot(snare)

    hihat =
      (1 * saw(t*400, 530) + noise(t) * 1.5)
      * arp(t, 1/16, 2000, 300, 20)
      * arp(t-1/2, 1/4, 1, 100, 2)
    hihat = clip(hihat, .31)
    hihat_delay.push(-hihat)
    hihat_delay.shift()
    // plot(hihat)

    var bass_hz = bassline[Math.floor( (t*4) % 16 )]
    // var bass_hz = slide(t, 1/16, 30, bassline)

    bass =
      bsaw(bass_hz)*2
    + saw(t, bass_hz*1.003)*2
    // + tri(t, bass_hz)*10
    + sin(t, bass_hz/1.33)*4.5
    bass = clip(bass*20)*1.34
    // plot(bass)

    bass = bass * arp(t-1.5, 1/4, 1.9, 6, 7) * arp(t, 1/16, 2, .5, 40)

    plot(bass)

    bass_delay.push(-bass)
    bass_delay.shift()

    return (0
    + kick * .9
    + snare * .5
    + (hihat - hihat_delay[0] + hihat_delay[3] + hihat_delay[4]) * .15
    + clip(bass - bass_delay[2+Math.floor(t%5)] - bass_delay[Math.floor(t%18)] - bass_delay[4] - bass_delay[10]) * .25
    )
  }
}
