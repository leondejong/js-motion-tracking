const store = {
  data: [],
  box: []
}

function getEnvironment (width = 768, height = 576, smooth = false) {
  const env = { canvas: document.createElement('canvas') }
  env.canvas.width = width
  env.canvas.height = height
  env.context = env.canvas.getContext('2d')
  env.context.imageSmoothingEnabled = smooth
  return env
}

function getData (image, width = 768, height = 576, env) {
  const w = image.width || width
  const h = image.height || height
  const { context } = env || getEnvironment(w, h)
  context.drawImage(image, 0, 0, w, h)
  return context.getImageData(0, 0, w, h).data
}

function drawData (context, d, x, y, w, h, f = x => x, p = []) {
  const processed = f(d, ...p)
  const imageData = new ImageData(processed, w, h)
  context.putImageData(imageData, x, y)
}

function getLuminance (r, g, b) {
  return (r + g + b) / 3
}

function getBrightness (r, g, b) {
  const rr = 0.299
  const rg = 0.587
  const rb = 0.114
  const tr = rr + rg + rg
  return (r * rr + g * rg + b * rb) / tr
}

function filter (data = [], f = () => {}) {
  const d = data.slice()
  for (let i = 0; i < d.length; i = i + 4) {
    const c = f(d[i + 0], d[i + 1], d[i + 2], d[i + 3])
    const { r, g, b, a } = c
    d[i + 0] = r
    d[i + 1] = g
    d[i + 2] = b
    d[i + 3] = a
  }
  return d
}

function getDifference (data, compare) {
  let n = 0
  return filter(data, (r, g, b) => {
    const cr = compare[n + 0]
    const cg = compare[n + 1]
    const cb = compare[n + 2]
    const l1 = getLuminance(r, g, b)
    const l2 = getLuminance(cr, cg, cb)
    const l3 = (255 - l1 + l2) / 2
    n += 4
    return { r: l3, g: l3, b: l3, a: 255 }
  })
}

function getAverage (data) {
  d = data.slice()

  let total = 0
  let min = 255
  let max = 0

  for (let i = 0; i < d.length; i = i + 4) {
    const luma = getLuminance(d[i + 0], d[i + 1], d[i + 2])
    total += luma
    if (luma > max) max = luma
    if (luma < min) min = luma
  }

  const mean = Math.round((total * 4) / d.length)

  min = Math.round(min)
  max = Math.round(max)

  return { mean, min, max }
}

function getBounds (data, width, threshold = 31, base = 128) {
  let pixel = 0
  let xMin = Infinity
  let xMax = 0
  let yMin = Infinity
  let yMax = 0
  filter(data, (r, g, b) => {
    const luma = getLuminance(r, g, b)
    const diff = Math.abs(Math.round(luma - base))
    if (diff > threshold) {
      coord = getCoordinate(pixel, width)
      if (coord.x < xMin) xMin = coord.x
      if (coord.x > xMax) xMax = coord.x
      if (coord.y < yMin) yMin = coord.y
      if (coord.y > yMax) yMax = coord.y
    }
    pixel++
    return { r, g, b, a: 255 }
  })
  return { xMin, xMax, yMin, yMax }
}

function getAverageRectangle (box, n = 3) {
  store.box.push(box)
  if (store.box.length > n) store.box.shift()
  const l = store.box.length
  const r = store.box.reduce(
    (p, c, i) => ({
      xMin: p.xMin + c.xMin,
      xMax: p.xMax + c.xMax,
      yMin: p.yMin + c.yMin,
      yMax: p.yMax + c.yMax
    }),
    {
      xMin: 0,
      xMax: 0,
      yMin: 0,
      yMax: 0
    }
  )
  return {
    x: r.xMin / l,
    y: r.yMin / l,
    w: r.xMax / l - r.xMin / l,
    h: r.yMax / l - r.yMin / l
  }
}

function getThreshold (data, factor = 0.67, ratio = 1.5, base = 127) {
  const { mean, min, max } = getAverage(data)
  const value = Math.abs(base - (min - max + 255) / 2)
  if (value > min * ratio && value < max / ratio) return value * factor
  return 255
}

function getCoordinate (index, width = 768) {
  return {
    x: index % width,
    y: Math.floor(index / width)
  }
}
