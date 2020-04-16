import * as settings from './settings.js'
import * as dsp from './dsp.js'

/* TODO: improve this */
self.onfetch = {}
self.onmessage = ({ data: { fetched }}) => {
  self.onfetch[fetched.url](fetched.sample)
}

async function run () {
  const setup = await dsp.setup(settings)
  postMessage(setup)
}

run()
