import { blockFrames } from '../settings.js'

export default function resample (f, sample, sig, offset) {
  return sample[(
    (f + (offset * blockFrames))
  * (sample.length / (blockFrames * sig))
  )|0]
}
