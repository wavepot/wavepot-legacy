const outer = document.getElementById('outer')
const pixelRatio = window.devicePixelRatio
const width = 200
const height = 100
// const width = window.innerWidth
// const height = window.innerHeight
outer.width = width * pixelRatio
outer.height = height * pixelRatio
outer.style.width = `${width}px`
outer.style.height = `${height}px`
const outerCanvas = outer.transferControlToOffscreen()
const worker = new Worker('./editor-worker.js')

worker.postMessage({ call: 'setup', outerCanvas, pixelRatio }, [outerCanvas])

const mouseEvent = e => {
  const clientX = e.clientX
  const clientY = e.clientY
  const deltaX = (e.deltaX || 0) / 1000
  const deltaY = (e.deltaY || 0) / 1000
  return {
    clientX,
    clientY,
    deltaX,
    deltaY,
    left: e.which === 1,
    middle: e.which === 2,
    right: e.which === 3
  }
}

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)

const keyEvent = ({
  key,
  which,
  altKey,
  shiftKey,
  ctrlKey,
  metaKey
}) => ({
  key,
  which,
  char: String.fromCharCode(which),
  altKey,
  shiftKey,
  ctrlKey,
  metaKey,
  cmdKey: isMac ? metaKey : ctrlKey
})

const windowEvent = e => ({})

const handlerMapper = fn => eventName => {
  const handler = e => {
    e.preventDefault()
    e.stopPropagation()
    worker.postMessage({
      call: eventName,
      ...fn(e)
    })
  }
  window.addEventListener(
    eventName.slice(2),
    handler,
    { passive: false }
  )
  return handler
}

const windowEventHandlers = [
  'onblur',
  'onfocus',
  'onresize'
].map(handlerMapper(windowEvent))

const keyEventHandlers = [
  'onkeydown',
  'onkeyup',
].map(handlerMapper(keyEvent))

const mouseEventHandlers = [
  'onmousewheel',
  'onmousedown'
].map(handlerMapper(mouseEvent))
