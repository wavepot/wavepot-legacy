
export function mix (fn) {
  class DSP extends AudioWorkletProcessor {
    static get parameterDescriptors () {
      return [{
        name: 't',
        defaultValue: 0
      }]
    }

    constructor (options) {
      super()
      console.log(options)
    }

    process (inputs, outputs, parameters) {
      const output = outputs[0]
      const t = parameters.t
      let s
      output.forEach(channel => {
        for (let i = 0; i < channel.length; i++) {
          channel[i] = fn(t[i]) // TODO: pass t in parameters
        }
      })
      return true
    }
  }

  registerProcessor('DSP', DSP)
}
