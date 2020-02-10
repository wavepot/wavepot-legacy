let audioContext

describe("new AudioContext", () => {
  it("should create a new AudioContext", () => {
    audioContext = new AudioContext()
    assert(audioContext instanceof AudioContext)
  })
})

describe("createBufferSource()", () => {
  it("should create a new BufferSource", (done) => {
    var bufferSize = 4 * audioContext.sampleRate,
    noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate),
    output = noiseBuffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    var whiteNoise = audioContext.createBufferSource();
    whiteNoise.buffer = noiseBuffer
    whiteNoise.loop = true
    whiteNoise.start(0)

    whiteNoise.connect(audioContext.destination)
    setTimeout(done, 5000)
  })
})
