import * as dsp from './dsp.js'
const exportTypes = Object.entries(dsp).reduce((p, [key, value]) => {
  if (key === 'draw') {
    p[key] = value.toString()
  } else if (key === 'setup') {
    p[key] = value.toString()
  } else {
    p[key] = value.constructor.name
  }
  return p
}, {})
postMessage(exportTypes)
