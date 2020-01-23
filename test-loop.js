import Sampler from './sampler.js'
import stretch from './stretch.js'

export default async () => {
  const buffer = await (await fetch('./samples/RAW_DDT_JAK_D.wav')).arrayBuffer()
  const audio = await decodeAudioData(buffer)
  const sample = new Sampler(stretch(audio, 4 * sampleRate))
  return ({ s: currentSample }) => sample.play(s)
}
