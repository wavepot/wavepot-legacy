import { draw } from './dsp.js'

let raf

const fps = 60

self.onmessage = ({ data }) => {
  let source

  if (data.offscreenCanvas) {
    self.canvas = data.offscreenCanvas
    source = draw.toString()
  } else {
    source = data.draw
  }

  const fn = new Function(
    'c','x','S','C','T','R',
    'a','b','d','e','f','g','h','i','j','k','l','m',
    'n','o','p','q','r','s','u','v','w','y','z',
    'A','B','D','E','F','G','H','I','J','K','L',
    'M','N','L','O','P','Q','U','V','W','X','Y','Z',
    `return ${source}`
  )(
    canvas,
    canvas.getContext('2d'),
    Math.sin,
    Math.cos,
    Math.tan,
    (r,g,b,a) => `rgba(${r},${g},${b},${a})`
  )

  let t = 0
  const drawLoop = () => {
    fn(performance.now() * .001)
    //fn(t += 0.01) //performance.now())
    raf = requestAnimationFrame(drawLoop)
  }

  try {
    fn(1) // test if fn throws before going in loop
    cancelAnimationFrame(raf)
    drawLoop()
  } catch (error) {
    console.error('Handled DrawError:', error)
  }
}
