
var drums = mix(
  './loop1.js',
  './loop2.js',
  // './loop3.js',
  // './loop4.js',
)

var bass = mix(
  './bass1.js',
  // './bass2.js',
  // './bass3.js',
  './bass3.js',
  // './bass3.js',
  // './bass3.js',
)

var keys = mix(
  './keys1.js',
  './keys2.js',
  ({ t, notes }) => notes.reduce((p, n) => p + Math.sin(n * t * Math.PI * 2)),
  // './bass3.js',
)

play(t =>
  .8 * stutter(t, drums, rand(4/4, [1, 1, 1, 1/4, -1/4, 1/8, -1/8]))
+ .4 * bass
+ .5 * keys
// + .5 * woosh
)
