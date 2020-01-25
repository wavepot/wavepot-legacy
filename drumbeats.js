import rand from './lib/seedable-random.js'
import fetchSample from './lib/fetch-sample.js'
import resample from './lib/resample.js'
import samples from './samples/index.js'
import pickRand from './lib/pick-rand.js'

export var dsp = async ({ seed = 101, images = [[101,'base',4,0,.4], [101,'highs',4,0,.4]] }) => {
  // 101, 2020, 9834, 9132, 9999, 751127, 123132
  // 123133, 1337, 132, 1122
  rand.seed(seed)

  var mix = images.map(async ([seed, name, beats, offset, vol]) => {
    rand.seed(seed)
    var audio = await fetchSample(pickRand(samples[name]))
    return [audio, beats, offset, vol]
  })

  mix = await Promise.all(mix)

  // images.forEach()
  // const base = await fetchSample(pickRand(samples.base))
  // const highs = await fetchSample(pickRand(samples.highs))
  // const highs2 = await fetchSample(pickRand(samples.highs))
  // const snare = await fetchSample(pickRand(samples.snare))
  // const snare2 = await fetchSample(pickRand(samples.snare))
  // const texture = await fetchSample(pickRand(samples.texture))
  // const tonal = await fetchSample(pickRand(samples.tonal))
  // const tonal2 = await fetchSample(pickRand(samples.tonal))
  // const tonal3 = await fetchSample(pickRand(samples.tonal))

  return (t, f) => {
    return mix.reduce((p, [audio, beats, offset, vol]) => (p + resample(f, audio, beats, offset) * vol), 0) * .5
    //   resample(f, base, 4, 0) * .4 //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, highs, 4, 0) * .2 //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, highs2, 4, 0) * .2 //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, snare, 4, 0) * .13  //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, snare2, 4, 0) * .13  //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, texture, 4, 0) * .12 //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, tonal, 4, 0) * .4 //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, tonal2, 4, 0) * .6 //* arp(t, 1/16, 2, 100, 20)
    // + resample(f, tonal3, 4, 0) * .3 //* arp(t, 1/16, 2, 100, 20)
    // * .5
  }
}
