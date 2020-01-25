const { readdirSync: dir, writeFileSync: write } = require('fs')

const base = './samples/'

const samples = {}

const dirs = ['base', 'highs', 'snare', 'texture', 'tonal']

dirs.forEach(d => {
  samples[d] = dir(d).map(f => `${base}${d}/${f}`)
})

write('index.js', `export default ${JSON.stringify(samples, null, 2)}`)
