export const sine = t => Math.sin(440 * t * Math.PI / 2)

export const anotherSine = t => Math.sin(330 * t * Math.PI / 2)

export const stereoSine = t => ([
  Math.sin(440 * t * Math.PI / 2),
  Math.sin(460 * t * Math.PI / 2)
])

export const setupSine = async (context) => {
  await new Promise(resolve => setTimeout(resolve, 10))
  return t => Math.sin(440 * t * Math.PI / 2)
}

export const broken = ({ n }) => [NaN,Infinity,-Infinity][n % 3]

const counterMap = new Float32Array(Array(32).fill().map((_, i) => i + 1))
export const counter = ({ n }) => counterMap[n % 32]
