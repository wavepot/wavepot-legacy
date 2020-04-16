const r=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

function FFT(size) {
  this.size = size | 0;
  if (this.size <= 1 || (this.size & (this.size - 1)) !== 0)
    throw new Error('FFT size must be a power of two and bigger than 1');

  this._csize = size << 1;

  // NOTE: Use of `var` is intentional for old V8 versions
  var table = new Float32Array(this.size * 2);
  for (var i = 0; i < table.length; i += 2) {
    const angle = Math.PI * i / this.size;
    table[i] = Math.cos(angle);
    table[i + 1] = -Math.sin(angle);
  }
  this.table = table;

  // Find size's power of two
  var power = 0;
  for (var t = 1; this.size > t; t <<= 1)
    power++;

  // Calculate initial step's width:
  //   * If we are full radix-4 - it is 2x smaller to give inital len=8
  //   * Otherwise it is the same as `power` to give len=4
  this._width = power % 2 === 0 ? power - 1 : power;

  // Pre-compute bit-reversal patterns
  this._bitrev = new Float32Array(1 << this._width);
  for (var j = 0; j < this._bitrev.length; j++) {
    this._bitrev[j] = 0;
    for (var shift = 0; shift < this._width; shift += 2) {
      var revShift = this._width - shift - 2;
      this._bitrev[j] |= ((j >>> shift) & 3) << revShift;
    }
  }

  this._out = null;
  this._data = null;
  this._inv = 0;
}
module.exports = FFT;

FFT.prototype.fromComplexArray = function fromComplexArray(complex, storage) {
  var res = storage || new Float32Array(complex.length >>> 1);
  for (var i = 0; i < complex.length; i += 2)
    res[i >>> 1] = complex[i];
  return res;
};

FFT.prototype.createComplexArray = function createComplexArray() {
  const res = new Float32Array(this._csize);
  for (var i = 0; i < res.length; i++)
    res[i] = 0;
  return res;
};

FFT.prototype.toComplexArray = function toComplexArray(input, storage) {
  var res = storage || this.createComplexArray();
  for (var i = 0; i < res.length; i += 2) {
    res[i] = input[i >>> 1];
    res[i + 1] = 0;
  }
  return res;
};

FFT.prototype.completeSpectrum = function completeSpectrum(spectrum) {
  var size = this._csize;
  var half = size >>> 1;
  for (var i = 2; i < half; i += 2) {
    spectrum[size - i] = spectrum[i];
    spectrum[size - i + 1] = -spectrum[i + 1];
  }
};

FFT.prototype.transform = function transform(out, data) {
  if (out === data)
    throw new Error('Input and output buffers must be different');

  this._out = out;
  this._data = data;
  this._inv = 0;
  this._transform4();
  this._out = null;
  this._data = null;
};

FFT.prototype.realTransform = function realTransform(out, data) {
  if (out === data)
    throw new Error('Input and output buffers must be different');

  this._out = out;
  this._data = data;
  this._inv = 0;
  this._realTransform4();
  this._out = null;
  this._data = null;
};

FFT.prototype.inverseTransform = function inverseTransform(out, data) {
  if (out === data)
    throw new Error('Input and output buffers must be different');

  this._out = out;
  this._data = data;
  this._inv = 1;
  this._transform4();
  for (var i = 0; i < out.length; i++)
    out[i] /= this.size;
  this._out = null;
  this._data = null;
};

// radix-4 implementation
//
// NOTE: Uses of `var` are intentional for older V8 version that do not
// support both `let compound assignments` and `const phi`
FFT.prototype._transform4 = function _transform4() {
  var out = this._out;
  var size = this._csize;

  // Initial step (permute and transform)
  var width = this._width;
  var step = 1 << width;
  var len = (size / step) << 1;

  var outOff;
  var t;
  var bitrev = this._bitrev;
  if (len === 4) {
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleTransform2(outOff, off, step);
    }
  } else {
    // len === 8
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleTransform4(outOff, off, step);
    }
  }

  // Loop through steps in decreasing order
  var inv = this._inv ? -1 : 1;
  var table = this.table;
  for (step >>= 2; step >= 2; step >>= 2) {
    len = (size / step) << 1;
    var quarterLen = len >>> 2;

    // Loop through offsets in the data
    for (outOff = 0; outOff < size; outOff += len) {
      // Full case
      var limit = outOff + quarterLen;
      for (var i = outOff, k = 0; i < limit; i += 2, k += step) {
        const A = i;
        const B = A + quarterLen;
        const C = B + quarterLen;
        const D = C + quarterLen;

        // Original values
        const Ar = out[A];
        const Ai = out[A + 1];
        const Br = out[B];
        const Bi = out[B + 1];
        const Cr = out[C];
        const Ci = out[C + 1];
        const Dr = out[D];
        const Di = out[D + 1];

        // Middle values
        const MAr = Ar;
        const MAi = Ai;

        const tableBr = table[k];
        const tableBi = inv * table[k + 1];
        const MBr = Br * tableBr - Bi * tableBi;
        const MBi = Br * tableBi + Bi * tableBr;

        const tableCr = table[2 * k];
        const tableCi = inv * table[2 * k + 1];
        const MCr = Cr * tableCr - Ci * tableCi;
        const MCi = Cr * tableCi + Ci * tableCr;

        const tableDr = table[3 * k];
        const tableDi = inv * table[3 * k + 1];
        const MDr = Dr * tableDr - Di * tableDi;
        const MDi = Dr * tableDi + Di * tableDr;

        // Pre-Final values
        const T0r = MAr + MCr;
        const T0i = MAi + MCi;
        const T1r = MAr - MCr;
        const T1i = MAi - MCi;
        const T2r = MBr + MDr;
        const T2i = MBi + MDi;
        const T3r = inv * (MBr - MDr);
        const T3i = inv * (MBi - MDi);

        // Final values
        const FAr = T0r + T2r;
        const FAi = T0i + T2i;

        const FCr = T0r - T2r;
        const FCi = T0i - T2i;

        const FBr = T1r + T3i;
        const FBi = T1i - T3r;

        const FDr = T1r - T3i;
        const FDi = T1i + T3r;

        out[A] = FAr;
        out[A + 1] = FAi;
        out[B] = FBr;
        out[B + 1] = FBi;
        out[C] = FCr;
        out[C + 1] = FCi;
        out[D] = FDr;
        out[D + 1] = FDi;
      }
    }
  }
};

// radix-2 implementation
//
// NOTE: Only called for len=4
FFT.prototype._singleTransform2 = function _singleTransform2(outOff, off,
                                                             step) {
  const out = this._out;
  const data = this._data;

  const evenR = data[off];
  const evenI = data[off + 1];
  const oddR = data[off + step];
  const oddI = data[off + step + 1];

  const leftR = evenR + oddR;
  const leftI = evenI + oddI;
  const rightR = evenR - oddR;
  const rightI = evenI - oddI;

  out[outOff] = leftR;
  out[outOff + 1] = leftI;
  out[outOff + 2] = rightR;
  out[outOff + 3] = rightI;
};

// radix-4
//
// NOTE: Only called for len=8
FFT.prototype._singleTransform4 = function _singleTransform4(outOff, off,
                                                             step) {
  const out = this._out;
  const data = this._data;
  const inv = this._inv ? -1 : 1;
  const step2 = step * 2;
  const step3 = step * 3;

  // Original values
  const Ar = data[off];
  const Ai = data[off + 1];
  const Br = data[off + step];
  const Bi = data[off + step + 1];
  const Cr = data[off + step2];
  const Ci = data[off + step2 + 1];
  const Dr = data[off + step3];
  const Di = data[off + step3 + 1];

  // Pre-Final values
  const T0r = Ar + Cr;
  const T0i = Ai + Ci;
  const T1r = Ar - Cr;
  const T1i = Ai - Ci;
  const T2r = Br + Dr;
  const T2i = Bi + Di;
  const T3r = inv * (Br - Dr);
  const T3i = inv * (Bi - Di);

  // Final values
  const FAr = T0r + T2r;
  const FAi = T0i + T2i;

  const FBr = T1r + T3i;
  const FBi = T1i - T3r;

  const FCr = T0r - T2r;
  const FCi = T0i - T2i;

  const FDr = T1r - T3i;
  const FDi = T1i + T3r;

  out[outOff] = FAr;
  out[outOff + 1] = FAi;
  out[outOff + 2] = FBr;
  out[outOff + 3] = FBi;
  out[outOff + 4] = FCr;
  out[outOff + 5] = FCi;
  out[outOff + 6] = FDr;
  out[outOff + 7] = FDi;
};

// Real input radix-4 implementation
FFT.prototype._realTransform4 = function _realTransform4() {
  var out = this._out;
  var size = this._csize;

  // Initial step (permute and transform)
  var width = this._width;
  var step = 1 << width;
  var len = (size / step) << 1;

  var outOff;
  var t;
  var bitrev = this._bitrev;
  if (len === 4) {
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleRealTransform2(outOff, off >>> 1, step >>> 1);
    }
  } else {
    // len === 8
    for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
      const off = bitrev[t];
      this._singleRealTransform4(outOff, off >>> 1, step >>> 1);
    }
  }

  // Loop through steps in decreasing order
  var inv = this._inv ? -1 : 1;
  var table = this.table;
  for (step >>= 2; step >= 2; step >>= 2) {
    len = (size / step) << 1;
    var halfLen = len >>> 1;
    var quarterLen = halfLen >>> 1;
    var hquarterLen = quarterLen >>> 1;

    // Loop through offsets in the data
    for (outOff = 0; outOff < size; outOff += len) {
      for (var i = 0, k = 0; i <= hquarterLen; i += 2, k += step) {
        var A = outOff + i;
        var B = A + quarterLen;
        var C = B + quarterLen;
        var D = C + quarterLen;

        // Original values
        var Ar = out[A];
        var Ai = out[A + 1];
        var Br = out[B];
        var Bi = out[B + 1];
        var Cr = out[C];
        var Ci = out[C + 1];
        var Dr = out[D];
        var Di = out[D + 1];

        // Middle values
        var MAr = Ar;
        var MAi = Ai;

        var tableBr = table[k];
        var tableBi = inv * table[k + 1];
        var MBr = Br * tableBr - Bi * tableBi;
        var MBi = Br * tableBi + Bi * tableBr;

        var tableCr = table[2 * k];
        var tableCi = inv * table[2 * k + 1];
        var MCr = Cr * tableCr - Ci * tableCi;
        var MCi = Cr * tableCi + Ci * tableCr;

        var tableDr = table[3 * k];
        var tableDi = inv * table[3 * k + 1];
        var MDr = Dr * tableDr - Di * tableDi;
        var MDi = Dr * tableDi + Di * tableDr;

        // Pre-Final values
        var T0r = MAr + MCr;
        var T0i = MAi + MCi;
        var T1r = MAr - MCr;
        var T1i = MAi - MCi;
        var T2r = MBr + MDr;
        var T2i = MBi + MDi;
        var T3r = inv * (MBr - MDr);
        var T3i = inv * (MBi - MDi);

        // Final values
        var FAr = T0r + T2r;
        var FAi = T0i + T2i;

        var FBr = T1r + T3i;
        var FBi = T1i - T3r;

        out[A] = FAr;
        out[A + 1] = FAi;
        out[B] = FBr;
        out[B + 1] = FBi;

        // Output final middle point
        if (i === 0) {
          var FCr = T0r - T2r;
          var FCi = T0i - T2i;
          out[C] = FCr;
          out[C + 1] = FCi;
          continue;
        }

        // Do not overwrite ourselves
        if (i === hquarterLen)
          continue;

        // In the flipped case:
        // MAi = -MAi
        // MBr=-MBi, MBi=-MBr
        // MCr=-MCr
        // MDr=MDi, MDi=MDr
        var ST0r = T1r;
        var ST0i = -T1i;
        var ST1r = T0r;
        var ST1i = -T0i;
        var ST2r = -inv * T3i;
        var ST2i = -inv * T3r;
        var ST3r = -inv * T2i;
        var ST3i = -inv * T2r;

        var SFAr = ST0r + ST2r;
        var SFAi = ST0i + ST2i;

        var SFBr = ST1r + ST3i;
        var SFBi = ST1i - ST3r;

        var SA = outOff + quarterLen - i;
        var SB = outOff + halfLen - i;

        out[SA] = SFAr;
        out[SA + 1] = SFAi;
        out[SB] = SFBr;
        out[SB + 1] = SFBi;
      }
    }
  }
};

// radix-2 implementation
//
// NOTE: Only called for len=4
FFT.prototype._singleRealTransform2 = function _singleRealTransform2(outOff,
                                                                     off,
                                                                     step) {
  const out = this._out;
  const data = this._data;

  const evenR = data[off];
  const oddR = data[off + step];

  const leftR = evenR + oddR;
  const rightR = evenR - oddR;

  out[outOff] = leftR;
  out[outOff + 1] = 0;
  out[outOff + 2] = rightR;
  out[outOff + 3] = 0;
};

// radix-4
//
// NOTE: Only called for len=8
FFT.prototype._singleRealTransform4 = function _singleRealTransform4(outOff,
                                                                     off,
                                                                     step) {
  const out = this._out;
  const data = this._data;
  const inv = this._inv ? -1 : 1;
  const step2 = step * 2;
  const step3 = step * 3;

  // Original values
  const Ar = data[off];
  const Br = data[off + step];
  const Cr = data[off + step2];
  const Dr = data[off + step3];

  // Pre-Final values
  const T0r = Ar + Cr;
  const T1r = Ar - Cr;
  const T2r = Br + Dr;
  const T3r = inv * (Br - Dr);

  // Final values
  const FAr = T0r + T2r;

  const FBr = T1r;
  const FBi = -T3r;

  const FCr = T0r - T2r;

  const FDr = T1r;
  const FDi = T3r;

  out[outOff] = FAr;
  out[outOff + 1] = 0;
  out[outOff + 2] = FBr;
  out[outOff + 3] = FBi;
  out[outOff + 4] = FCr;
  out[outOff + 5] = 0;
  out[outOff + 6] = FDr;
  out[outOff + 7] = FDi;
};

},{}],2:[function(require,module,exports){
module.exports = nextPowerOfTwo

function nextPowerOfTwo (n) {
  if (n === 0) return 1
  n--
  n |= n >> 1
  n |= n >> 2
  n |= n >> 4
  n |= n >> 8
  n |= n >> 16
  return n+1
}
},{}],"ml-convolution":[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var FFT = _interopDefault(require('fft.js'));
var nextPOT = _interopDefault(require('next-power-of-two'));

function directConvolution(input, kernel) {
    const length = input.length + kernel.length - 1;
    const output = new Float32Array(length);
    output.fill(0);
    for (var i = 0; i < input.length; i++) {
        for (var j = 0; j < kernel.length; j++) {
            output[i + j] += input[i] * kernel[j];
        }
    }
    return output;
}

function fftConvolution(input, kernel) {
    const resultLength = input.length + kernel.length - 1;
    const fftLength = nextPOT(resultLength);

    const fft = new FFT(fftLength);

    const {output: fftKernel, input: result} = createPaddedFFt(kernel, fft, fftLength);
    const {output: fftInput} = createPaddedFFt(input, fft, fftLength);

    // reuse arrays
    const fftConv = fftInput;
    const conv = fftKernel;
    for (var i = 0; i < fftConv.length; i += 2) {
        const tmp = fftInput[i] * fftKernel[i] - fftInput[i + 1] * fftKernel[i + 1];
        fftConv[i + 1] = fftInput[i] * fftKernel[i + 1] + fftInput[i + 1] * fftKernel[i];
        fftConv[i] = tmp;
    }
    fft.inverseTransform(conv, fftConv);
    return fft.fromComplexArray(conv, result).slice(0, resultLength);
}

function createPaddedFFt(data, fft, length) {
    const input = new Float32Array(length);
    input.set(data)
    // var i = 0;
    // for (; i < data.length; i++) {
    //     input[i] = data[i];
    // }
    // for (;i < length; i++) {
    //     input[i] = 0;
    // }
    const fftInput = fft.toComplexArray(input);
    const output = fft.createComplexArray();
    fft.transform(output, fftInput);
    return {
        output,
        input,
        fftInput
    };
}

exports.directConvolution = directConvolution;
exports.fftConvolution = fftConvolution;

},{"fft.js":1,"next-power-of-two":2}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL2hvbWUvd3pyZC93enJkLmluL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmZ0LmpzL2xpYi9mZnQuanMiLCJub2RlX21vZHVsZXMvbmV4dC1wb3dlci1vZi10d28vaW5kZXguanMiLCJtbC1jb252b2x1dGlvbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIEZGVChzaXplKSB7XG4gIHRoaXMuc2l6ZSA9IHNpemUgfCAwO1xuICBpZiAodGhpcy5zaXplIDw9IDEgfHwgKHRoaXMuc2l6ZSAmICh0aGlzLnNpemUgLSAxKSkgIT09IDApXG4gICAgdGhyb3cgbmV3IEVycm9yKCdGRlQgc2l6ZSBtdXN0IGJlIGEgcG93ZXIgb2YgdHdvIGFuZCBiaWdnZXIgdGhhbiAxJyk7XG5cbiAgdGhpcy5fY3NpemUgPSBzaXplIDw8IDE7XG5cbiAgLy8gTk9URTogVXNlIG9mIGB2YXJgIGlzIGludGVudGlvbmFsIGZvciBvbGQgVjggdmVyc2lvbnNcbiAgdmFyIHRhYmxlID0gbmV3IEFycmF5KHRoaXMuc2l6ZSAqIDIpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHRhYmxlLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgY29uc3QgYW5nbGUgPSBNYXRoLlBJICogaSAvIHRoaXMuc2l6ZTtcbiAgICB0YWJsZVtpXSA9IE1hdGguY29zKGFuZ2xlKTtcbiAgICB0YWJsZVtpICsgMV0gPSAtTWF0aC5zaW4oYW5nbGUpO1xuICB9XG4gIHRoaXMudGFibGUgPSB0YWJsZTtcblxuICAvLyBGaW5kIHNpemUncyBwb3dlciBvZiB0d29cbiAgdmFyIHBvd2VyID0gMDtcbiAgZm9yICh2YXIgdCA9IDE7IHRoaXMuc2l6ZSA+IHQ7IHQgPDw9IDEpXG4gICAgcG93ZXIrKztcblxuICAvLyBDYWxjdWxhdGUgaW5pdGlhbCBzdGVwJ3Mgd2lkdGg6XG4gIC8vICAgKiBJZiB3ZSBhcmUgZnVsbCByYWRpeC00IC0gaXQgaXMgMnggc21hbGxlciB0byBnaXZlIGluaXRhbCBsZW49OFxuICAvLyAgICogT3RoZXJ3aXNlIGl0IGlzIHRoZSBzYW1lIGFzIGBwb3dlcmAgdG8gZ2l2ZSBsZW49NFxuICB0aGlzLl93aWR0aCA9IHBvd2VyICUgMiA9PT0gMCA/IHBvd2VyIC0gMSA6IHBvd2VyO1xuXG4gIC8vIFByZS1jb21wdXRlIGJpdC1yZXZlcnNhbCBwYXR0ZXJuc1xuICB0aGlzLl9iaXRyZXYgPSBuZXcgQXJyYXkoMSA8PCB0aGlzLl93aWR0aCk7XG4gIGZvciAodmFyIGogPSAwOyBqIDwgdGhpcy5fYml0cmV2Lmxlbmd0aDsgaisrKSB7XG4gICAgdGhpcy5fYml0cmV2W2pdID0gMDtcbiAgICBmb3IgKHZhciBzaGlmdCA9IDA7IHNoaWZ0IDwgdGhpcy5fd2lkdGg7IHNoaWZ0ICs9IDIpIHtcbiAgICAgIHZhciByZXZTaGlmdCA9IHRoaXMuX3dpZHRoIC0gc2hpZnQgLSAyO1xuICAgICAgdGhpcy5fYml0cmV2W2pdIHw9ICgoaiA+Pj4gc2hpZnQpICYgMykgPDwgcmV2U2hpZnQ7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5fb3V0ID0gbnVsbDtcbiAgdGhpcy5fZGF0YSA9IG51bGw7XG4gIHRoaXMuX2ludiA9IDA7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEZGVDtcblxuRkZULnByb3RvdHlwZS5mcm9tQ29tcGxleEFycmF5ID0gZnVuY3Rpb24gZnJvbUNvbXBsZXhBcnJheShjb21wbGV4LCBzdG9yYWdlKSB7XG4gIHZhciByZXMgPSBzdG9yYWdlIHx8IG5ldyBBcnJheShjb21wbGV4Lmxlbmd0aCA+Pj4gMSk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY29tcGxleC5sZW5ndGg7IGkgKz0gMilcbiAgICByZXNbaSA+Pj4gMV0gPSBjb21wbGV4W2ldO1xuICByZXR1cm4gcmVzO1xufTtcblxuRkZULnByb3RvdHlwZS5jcmVhdGVDb21wbGV4QXJyYXkgPSBmdW5jdGlvbiBjcmVhdGVDb21wbGV4QXJyYXkoKSB7XG4gIGNvbnN0IHJlcyA9IG5ldyBBcnJheSh0aGlzLl9jc2l6ZSk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzLmxlbmd0aDsgaSsrKVxuICAgIHJlc1tpXSA9IDA7XG4gIHJldHVybiByZXM7XG59O1xuXG5GRlQucHJvdG90eXBlLnRvQ29tcGxleEFycmF5ID0gZnVuY3Rpb24gdG9Db21wbGV4QXJyYXkoaW5wdXQsIHN0b3JhZ2UpIHtcbiAgdmFyIHJlcyA9IHN0b3JhZ2UgfHwgdGhpcy5jcmVhdGVDb21wbGV4QXJyYXkoKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXNbaV0gPSBpbnB1dFtpID4+PiAxXTtcbiAgICByZXNbaSArIDFdID0gMDtcbiAgfVxuICByZXR1cm4gcmVzO1xufTtcblxuRkZULnByb3RvdHlwZS5jb21wbGV0ZVNwZWN0cnVtID0gZnVuY3Rpb24gY29tcGxldGVTcGVjdHJ1bShzcGVjdHJ1bSkge1xuICB2YXIgc2l6ZSA9IHRoaXMuX2NzaXplO1xuICB2YXIgaGFsZiA9IHNpemUgPj4+IDE7XG4gIGZvciAodmFyIGkgPSAyOyBpIDwgaGFsZjsgaSArPSAyKSB7XG4gICAgc3BlY3RydW1bc2l6ZSAtIGldID0gc3BlY3RydW1baV07XG4gICAgc3BlY3RydW1bc2l6ZSAtIGkgKyAxXSA9IC1zcGVjdHJ1bVtpICsgMV07XG4gIH1cbn07XG5cbkZGVC5wcm90b3R5cGUudHJhbnNmb3JtID0gZnVuY3Rpb24gdHJhbnNmb3JtKG91dCwgZGF0YSkge1xuICBpZiAob3V0ID09PSBkYXRhKVxuICAgIHRocm93IG5ldyBFcnJvcignSW5wdXQgYW5kIG91dHB1dCBidWZmZXJzIG11c3QgYmUgZGlmZmVyZW50Jyk7XG5cbiAgdGhpcy5fb3V0ID0gb3V0O1xuICB0aGlzLl9kYXRhID0gZGF0YTtcbiAgdGhpcy5faW52ID0gMDtcbiAgdGhpcy5fdHJhbnNmb3JtNCgpO1xuICB0aGlzLl9vdXQgPSBudWxsO1xuICB0aGlzLl9kYXRhID0gbnVsbDtcbn07XG5cbkZGVC5wcm90b3R5cGUucmVhbFRyYW5zZm9ybSA9IGZ1bmN0aW9uIHJlYWxUcmFuc2Zvcm0ob3V0LCBkYXRhKSB7XG4gIGlmIChvdXQgPT09IGRhdGEpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnB1dCBhbmQgb3V0cHV0IGJ1ZmZlcnMgbXVzdCBiZSBkaWZmZXJlbnQnKTtcblxuICB0aGlzLl9vdXQgPSBvdXQ7XG4gIHRoaXMuX2RhdGEgPSBkYXRhO1xuICB0aGlzLl9pbnYgPSAwO1xuICB0aGlzLl9yZWFsVHJhbnNmb3JtNCgpO1xuICB0aGlzLl9vdXQgPSBudWxsO1xuICB0aGlzLl9kYXRhID0gbnVsbDtcbn07XG5cbkZGVC5wcm90b3R5cGUuaW52ZXJzZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIGludmVyc2VUcmFuc2Zvcm0ob3V0LCBkYXRhKSB7XG4gIGlmIChvdXQgPT09IGRhdGEpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnB1dCBhbmQgb3V0cHV0IGJ1ZmZlcnMgbXVzdCBiZSBkaWZmZXJlbnQnKTtcblxuICB0aGlzLl9vdXQgPSBvdXQ7XG4gIHRoaXMuX2RhdGEgPSBkYXRhO1xuICB0aGlzLl9pbnYgPSAxO1xuICB0aGlzLl90cmFuc2Zvcm00KCk7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgb3V0Lmxlbmd0aDsgaSsrKVxuICAgIG91dFtpXSAvPSB0aGlzLnNpemU7XG4gIHRoaXMuX291dCA9IG51bGw7XG4gIHRoaXMuX2RhdGEgPSBudWxsO1xufTtcblxuLy8gcmFkaXgtNCBpbXBsZW1lbnRhdGlvblxuLy9cbi8vIE5PVEU6IFVzZXMgb2YgYHZhcmAgYXJlIGludGVudGlvbmFsIGZvciBvbGRlciBWOCB2ZXJzaW9uIHRoYXQgZG8gbm90XG4vLyBzdXBwb3J0IGJvdGggYGxldCBjb21wb3VuZCBhc3NpZ25tZW50c2AgYW5kIGBjb25zdCBwaGlgXG5GRlQucHJvdG90eXBlLl90cmFuc2Zvcm00ID0gZnVuY3Rpb24gX3RyYW5zZm9ybTQoKSB7XG4gIHZhciBvdXQgPSB0aGlzLl9vdXQ7XG4gIHZhciBzaXplID0gdGhpcy5fY3NpemU7XG5cbiAgLy8gSW5pdGlhbCBzdGVwIChwZXJtdXRlIGFuZCB0cmFuc2Zvcm0pXG4gIHZhciB3aWR0aCA9IHRoaXMuX3dpZHRoO1xuICB2YXIgc3RlcCA9IDEgPDwgd2lkdGg7XG4gIHZhciBsZW4gPSAoc2l6ZSAvIHN0ZXApIDw8IDE7XG5cbiAgdmFyIG91dE9mZjtcbiAgdmFyIHQ7XG4gIHZhciBiaXRyZXYgPSB0aGlzLl9iaXRyZXY7XG4gIGlmIChsZW4gPT09IDQpIHtcbiAgICBmb3IgKG91dE9mZiA9IDAsIHQgPSAwOyBvdXRPZmYgPCBzaXplOyBvdXRPZmYgKz0gbGVuLCB0KyspIHtcbiAgICAgIGNvbnN0IG9mZiA9IGJpdHJldlt0XTtcbiAgICAgIHRoaXMuX3NpbmdsZVRyYW5zZm9ybTIob3V0T2ZmLCBvZmYsIHN0ZXApO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBsZW4gPT09IDhcbiAgICBmb3IgKG91dE9mZiA9IDAsIHQgPSAwOyBvdXRPZmYgPCBzaXplOyBvdXRPZmYgKz0gbGVuLCB0KyspIHtcbiAgICAgIGNvbnN0IG9mZiA9IGJpdHJldlt0XTtcbiAgICAgIHRoaXMuX3NpbmdsZVRyYW5zZm9ybTQob3V0T2ZmLCBvZmYsIHN0ZXApO1xuICAgIH1cbiAgfVxuXG4gIC8vIExvb3AgdGhyb3VnaCBzdGVwcyBpbiBkZWNyZWFzaW5nIG9yZGVyXG4gIHZhciBpbnYgPSB0aGlzLl9pbnYgPyAtMSA6IDE7XG4gIHZhciB0YWJsZSA9IHRoaXMudGFibGU7XG4gIGZvciAoc3RlcCA+Pj0gMjsgc3RlcCA+PSAyOyBzdGVwID4+PSAyKSB7XG4gICAgbGVuID0gKHNpemUgLyBzdGVwKSA8PCAxO1xuICAgIHZhciBxdWFydGVyTGVuID0gbGVuID4+PiAyO1xuXG4gICAgLy8gTG9vcCB0aHJvdWdoIG9mZnNldHMgaW4gdGhlIGRhdGFcbiAgICBmb3IgKG91dE9mZiA9IDA7IG91dE9mZiA8IHNpemU7IG91dE9mZiArPSBsZW4pIHtcbiAgICAgIC8vIEZ1bGwgY2FzZVxuICAgICAgdmFyIGxpbWl0ID0gb3V0T2ZmICsgcXVhcnRlckxlbjtcbiAgICAgIGZvciAodmFyIGkgPSBvdXRPZmYsIGsgPSAwOyBpIDwgbGltaXQ7IGkgKz0gMiwgayArPSBzdGVwKSB7XG4gICAgICAgIGNvbnN0IEEgPSBpO1xuICAgICAgICBjb25zdCBCID0gQSArIHF1YXJ0ZXJMZW47XG4gICAgICAgIGNvbnN0IEMgPSBCICsgcXVhcnRlckxlbjtcbiAgICAgICAgY29uc3QgRCA9IEMgKyBxdWFydGVyTGVuO1xuXG4gICAgICAgIC8vIE9yaWdpbmFsIHZhbHVlc1xuICAgICAgICBjb25zdCBBciA9IG91dFtBXTtcbiAgICAgICAgY29uc3QgQWkgPSBvdXRbQSArIDFdO1xuICAgICAgICBjb25zdCBCciA9IG91dFtCXTtcbiAgICAgICAgY29uc3QgQmkgPSBvdXRbQiArIDFdO1xuICAgICAgICBjb25zdCBDciA9IG91dFtDXTtcbiAgICAgICAgY29uc3QgQ2kgPSBvdXRbQyArIDFdO1xuICAgICAgICBjb25zdCBEciA9IG91dFtEXTtcbiAgICAgICAgY29uc3QgRGkgPSBvdXRbRCArIDFdO1xuXG4gICAgICAgIC8vIE1pZGRsZSB2YWx1ZXNcbiAgICAgICAgY29uc3QgTUFyID0gQXI7XG4gICAgICAgIGNvbnN0IE1BaSA9IEFpO1xuXG4gICAgICAgIGNvbnN0IHRhYmxlQnIgPSB0YWJsZVtrXTtcbiAgICAgICAgY29uc3QgdGFibGVCaSA9IGludiAqIHRhYmxlW2sgKyAxXTtcbiAgICAgICAgY29uc3QgTUJyID0gQnIgKiB0YWJsZUJyIC0gQmkgKiB0YWJsZUJpO1xuICAgICAgICBjb25zdCBNQmkgPSBCciAqIHRhYmxlQmkgKyBCaSAqIHRhYmxlQnI7XG5cbiAgICAgICAgY29uc3QgdGFibGVDciA9IHRhYmxlWzIgKiBrXTtcbiAgICAgICAgY29uc3QgdGFibGVDaSA9IGludiAqIHRhYmxlWzIgKiBrICsgMV07XG4gICAgICAgIGNvbnN0IE1DciA9IENyICogdGFibGVDciAtIENpICogdGFibGVDaTtcbiAgICAgICAgY29uc3QgTUNpID0gQ3IgKiB0YWJsZUNpICsgQ2kgKiB0YWJsZUNyO1xuXG4gICAgICAgIGNvbnN0IHRhYmxlRHIgPSB0YWJsZVszICoga107XG4gICAgICAgIGNvbnN0IHRhYmxlRGkgPSBpbnYgKiB0YWJsZVszICogayArIDFdO1xuICAgICAgICBjb25zdCBNRHIgPSBEciAqIHRhYmxlRHIgLSBEaSAqIHRhYmxlRGk7XG4gICAgICAgIGNvbnN0IE1EaSA9IERyICogdGFibGVEaSArIERpICogdGFibGVEcjtcblxuICAgICAgICAvLyBQcmUtRmluYWwgdmFsdWVzXG4gICAgICAgIGNvbnN0IFQwciA9IE1BciArIE1DcjtcbiAgICAgICAgY29uc3QgVDBpID0gTUFpICsgTUNpO1xuICAgICAgICBjb25zdCBUMXIgPSBNQXIgLSBNQ3I7XG4gICAgICAgIGNvbnN0IFQxaSA9IE1BaSAtIE1DaTtcbiAgICAgICAgY29uc3QgVDJyID0gTUJyICsgTURyO1xuICAgICAgICBjb25zdCBUMmkgPSBNQmkgKyBNRGk7XG4gICAgICAgIGNvbnN0IFQzciA9IGludiAqIChNQnIgLSBNRHIpO1xuICAgICAgICBjb25zdCBUM2kgPSBpbnYgKiAoTUJpIC0gTURpKTtcblxuICAgICAgICAvLyBGaW5hbCB2YWx1ZXNcbiAgICAgICAgY29uc3QgRkFyID0gVDByICsgVDJyO1xuICAgICAgICBjb25zdCBGQWkgPSBUMGkgKyBUMmk7XG5cbiAgICAgICAgY29uc3QgRkNyID0gVDByIC0gVDJyO1xuICAgICAgICBjb25zdCBGQ2kgPSBUMGkgLSBUMmk7XG5cbiAgICAgICAgY29uc3QgRkJyID0gVDFyICsgVDNpO1xuICAgICAgICBjb25zdCBGQmkgPSBUMWkgLSBUM3I7XG5cbiAgICAgICAgY29uc3QgRkRyID0gVDFyIC0gVDNpO1xuICAgICAgICBjb25zdCBGRGkgPSBUMWkgKyBUM3I7XG5cbiAgICAgICAgb3V0W0FdID0gRkFyO1xuICAgICAgICBvdXRbQSArIDFdID0gRkFpO1xuICAgICAgICBvdXRbQl0gPSBGQnI7XG4gICAgICAgIG91dFtCICsgMV0gPSBGQmk7XG4gICAgICAgIG91dFtDXSA9IEZDcjtcbiAgICAgICAgb3V0W0MgKyAxXSA9IEZDaTtcbiAgICAgICAgb3V0W0RdID0gRkRyO1xuICAgICAgICBvdXRbRCArIDFdID0gRkRpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuLy8gcmFkaXgtMiBpbXBsZW1lbnRhdGlvblxuLy9cbi8vIE5PVEU6IE9ubHkgY2FsbGVkIGZvciBsZW49NFxuRkZULnByb3RvdHlwZS5fc2luZ2xlVHJhbnNmb3JtMiA9IGZ1bmN0aW9uIF9zaW5nbGVUcmFuc2Zvcm0yKG91dE9mZiwgb2ZmLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXApIHtcbiAgY29uc3Qgb3V0ID0gdGhpcy5fb3V0O1xuICBjb25zdCBkYXRhID0gdGhpcy5fZGF0YTtcblxuICBjb25zdCBldmVuUiA9IGRhdGFbb2ZmXTtcbiAgY29uc3QgZXZlbkkgPSBkYXRhW29mZiArIDFdO1xuICBjb25zdCBvZGRSID0gZGF0YVtvZmYgKyBzdGVwXTtcbiAgY29uc3Qgb2RkSSA9IGRhdGFbb2ZmICsgc3RlcCArIDFdO1xuXG4gIGNvbnN0IGxlZnRSID0gZXZlblIgKyBvZGRSO1xuICBjb25zdCBsZWZ0SSA9IGV2ZW5JICsgb2RkSTtcbiAgY29uc3QgcmlnaHRSID0gZXZlblIgLSBvZGRSO1xuICBjb25zdCByaWdodEkgPSBldmVuSSAtIG9kZEk7XG5cbiAgb3V0W291dE9mZl0gPSBsZWZ0UjtcbiAgb3V0W291dE9mZiArIDFdID0gbGVmdEk7XG4gIG91dFtvdXRPZmYgKyAyXSA9IHJpZ2h0UjtcbiAgb3V0W291dE9mZiArIDNdID0gcmlnaHRJO1xufTtcblxuLy8gcmFkaXgtNFxuLy9cbi8vIE5PVEU6IE9ubHkgY2FsbGVkIGZvciBsZW49OFxuRkZULnByb3RvdHlwZS5fc2luZ2xlVHJhbnNmb3JtNCA9IGZ1bmN0aW9uIF9zaW5nbGVUcmFuc2Zvcm00KG91dE9mZiwgb2ZmLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXApIHtcbiAgY29uc3Qgb3V0ID0gdGhpcy5fb3V0O1xuICBjb25zdCBkYXRhID0gdGhpcy5fZGF0YTtcbiAgY29uc3QgaW52ID0gdGhpcy5faW52ID8gLTEgOiAxO1xuICBjb25zdCBzdGVwMiA9IHN0ZXAgKiAyO1xuICBjb25zdCBzdGVwMyA9IHN0ZXAgKiAzO1xuXG4gIC8vIE9yaWdpbmFsIHZhbHVlc1xuICBjb25zdCBBciA9IGRhdGFbb2ZmXTtcbiAgY29uc3QgQWkgPSBkYXRhW29mZiArIDFdO1xuICBjb25zdCBCciA9IGRhdGFbb2ZmICsgc3RlcF07XG4gIGNvbnN0IEJpID0gZGF0YVtvZmYgKyBzdGVwICsgMV07XG4gIGNvbnN0IENyID0gZGF0YVtvZmYgKyBzdGVwMl07XG4gIGNvbnN0IENpID0gZGF0YVtvZmYgKyBzdGVwMiArIDFdO1xuICBjb25zdCBEciA9IGRhdGFbb2ZmICsgc3RlcDNdO1xuICBjb25zdCBEaSA9IGRhdGFbb2ZmICsgc3RlcDMgKyAxXTtcblxuICAvLyBQcmUtRmluYWwgdmFsdWVzXG4gIGNvbnN0IFQwciA9IEFyICsgQ3I7XG4gIGNvbnN0IFQwaSA9IEFpICsgQ2k7XG4gIGNvbnN0IFQxciA9IEFyIC0gQ3I7XG4gIGNvbnN0IFQxaSA9IEFpIC0gQ2k7XG4gIGNvbnN0IFQyciA9IEJyICsgRHI7XG4gIGNvbnN0IFQyaSA9IEJpICsgRGk7XG4gIGNvbnN0IFQzciA9IGludiAqIChCciAtIERyKTtcbiAgY29uc3QgVDNpID0gaW52ICogKEJpIC0gRGkpO1xuXG4gIC8vIEZpbmFsIHZhbHVlc1xuICBjb25zdCBGQXIgPSBUMHIgKyBUMnI7XG4gIGNvbnN0IEZBaSA9IFQwaSArIFQyaTtcblxuICBjb25zdCBGQnIgPSBUMXIgKyBUM2k7XG4gIGNvbnN0IEZCaSA9IFQxaSAtIFQzcjtcblxuICBjb25zdCBGQ3IgPSBUMHIgLSBUMnI7XG4gIGNvbnN0IEZDaSA9IFQwaSAtIFQyaTtcblxuICBjb25zdCBGRHIgPSBUMXIgLSBUM2k7XG4gIGNvbnN0IEZEaSA9IFQxaSArIFQzcjtcblxuICBvdXRbb3V0T2ZmXSA9IEZBcjtcbiAgb3V0W291dE9mZiArIDFdID0gRkFpO1xuICBvdXRbb3V0T2ZmICsgMl0gPSBGQnI7XG4gIG91dFtvdXRPZmYgKyAzXSA9IEZCaTtcbiAgb3V0W291dE9mZiArIDRdID0gRkNyO1xuICBvdXRbb3V0T2ZmICsgNV0gPSBGQ2k7XG4gIG91dFtvdXRPZmYgKyA2XSA9IEZEcjtcbiAgb3V0W291dE9mZiArIDddID0gRkRpO1xufTtcblxuLy8gUmVhbCBpbnB1dCByYWRpeC00IGltcGxlbWVudGF0aW9uXG5GRlQucHJvdG90eXBlLl9yZWFsVHJhbnNmb3JtNCA9IGZ1bmN0aW9uIF9yZWFsVHJhbnNmb3JtNCgpIHtcbiAgdmFyIG91dCA9IHRoaXMuX291dDtcbiAgdmFyIHNpemUgPSB0aGlzLl9jc2l6ZTtcblxuICAvLyBJbml0aWFsIHN0ZXAgKHBlcm11dGUgYW5kIHRyYW5zZm9ybSlcbiAgdmFyIHdpZHRoID0gdGhpcy5fd2lkdGg7XG4gIHZhciBzdGVwID0gMSA8PCB3aWR0aDtcbiAgdmFyIGxlbiA9IChzaXplIC8gc3RlcCkgPDwgMTtcblxuICB2YXIgb3V0T2ZmO1xuICB2YXIgdDtcbiAgdmFyIGJpdHJldiA9IHRoaXMuX2JpdHJldjtcbiAgaWYgKGxlbiA9PT0gNCkge1xuICAgIGZvciAob3V0T2ZmID0gMCwgdCA9IDA7IG91dE9mZiA8IHNpemU7IG91dE9mZiArPSBsZW4sIHQrKykge1xuICAgICAgY29uc3Qgb2ZmID0gYml0cmV2W3RdO1xuICAgICAgdGhpcy5fc2luZ2xlUmVhbFRyYW5zZm9ybTIob3V0T2ZmLCBvZmYgPj4+IDEsIHN0ZXAgPj4+IDEpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBsZW4gPT09IDhcbiAgICBmb3IgKG91dE9mZiA9IDAsIHQgPSAwOyBvdXRPZmYgPCBzaXplOyBvdXRPZmYgKz0gbGVuLCB0KyspIHtcbiAgICAgIGNvbnN0IG9mZiA9IGJpdHJldlt0XTtcbiAgICAgIHRoaXMuX3NpbmdsZVJlYWxUcmFuc2Zvcm00KG91dE9mZiwgb2ZmID4+PiAxLCBzdGVwID4+PiAxKTtcbiAgICB9XG4gIH1cblxuICAvLyBMb29wIHRocm91Z2ggc3RlcHMgaW4gZGVjcmVhc2luZyBvcmRlclxuICB2YXIgaW52ID0gdGhpcy5faW52ID8gLTEgOiAxO1xuICB2YXIgdGFibGUgPSB0aGlzLnRhYmxlO1xuICBmb3IgKHN0ZXAgPj49IDI7IHN0ZXAgPj0gMjsgc3RlcCA+Pj0gMikge1xuICAgIGxlbiA9IChzaXplIC8gc3RlcCkgPDwgMTtcbiAgICB2YXIgaGFsZkxlbiA9IGxlbiA+Pj4gMTtcbiAgICB2YXIgcXVhcnRlckxlbiA9IGhhbGZMZW4gPj4+IDE7XG4gICAgdmFyIGhxdWFydGVyTGVuID0gcXVhcnRlckxlbiA+Pj4gMTtcblxuICAgIC8vIExvb3AgdGhyb3VnaCBvZmZzZXRzIGluIHRoZSBkYXRhXG4gICAgZm9yIChvdXRPZmYgPSAwOyBvdXRPZmYgPCBzaXplOyBvdXRPZmYgKz0gbGVuKSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgayA9IDA7IGkgPD0gaHF1YXJ0ZXJMZW47IGkgKz0gMiwgayArPSBzdGVwKSB7XG4gICAgICAgIHZhciBBID0gb3V0T2ZmICsgaTtcbiAgICAgICAgdmFyIEIgPSBBICsgcXVhcnRlckxlbjtcbiAgICAgICAgdmFyIEMgPSBCICsgcXVhcnRlckxlbjtcbiAgICAgICAgdmFyIEQgPSBDICsgcXVhcnRlckxlbjtcblxuICAgICAgICAvLyBPcmlnaW5hbCB2YWx1ZXNcbiAgICAgICAgdmFyIEFyID0gb3V0W0FdO1xuICAgICAgICB2YXIgQWkgPSBvdXRbQSArIDFdO1xuICAgICAgICB2YXIgQnIgPSBvdXRbQl07XG4gICAgICAgIHZhciBCaSA9IG91dFtCICsgMV07XG4gICAgICAgIHZhciBDciA9IG91dFtDXTtcbiAgICAgICAgdmFyIENpID0gb3V0W0MgKyAxXTtcbiAgICAgICAgdmFyIERyID0gb3V0W0RdO1xuICAgICAgICB2YXIgRGkgPSBvdXRbRCArIDFdO1xuXG4gICAgICAgIC8vIE1pZGRsZSB2YWx1ZXNcbiAgICAgICAgdmFyIE1BciA9IEFyO1xuICAgICAgICB2YXIgTUFpID0gQWk7XG5cbiAgICAgICAgdmFyIHRhYmxlQnIgPSB0YWJsZVtrXTtcbiAgICAgICAgdmFyIHRhYmxlQmkgPSBpbnYgKiB0YWJsZVtrICsgMV07XG4gICAgICAgIHZhciBNQnIgPSBCciAqIHRhYmxlQnIgLSBCaSAqIHRhYmxlQmk7XG4gICAgICAgIHZhciBNQmkgPSBCciAqIHRhYmxlQmkgKyBCaSAqIHRhYmxlQnI7XG5cbiAgICAgICAgdmFyIHRhYmxlQ3IgPSB0YWJsZVsyICoga107XG4gICAgICAgIHZhciB0YWJsZUNpID0gaW52ICogdGFibGVbMiAqIGsgKyAxXTtcbiAgICAgICAgdmFyIE1DciA9IENyICogdGFibGVDciAtIENpICogdGFibGVDaTtcbiAgICAgICAgdmFyIE1DaSA9IENyICogdGFibGVDaSArIENpICogdGFibGVDcjtcblxuICAgICAgICB2YXIgdGFibGVEciA9IHRhYmxlWzMgKiBrXTtcbiAgICAgICAgdmFyIHRhYmxlRGkgPSBpbnYgKiB0YWJsZVszICogayArIDFdO1xuICAgICAgICB2YXIgTURyID0gRHIgKiB0YWJsZURyIC0gRGkgKiB0YWJsZURpO1xuICAgICAgICB2YXIgTURpID0gRHIgKiB0YWJsZURpICsgRGkgKiB0YWJsZURyO1xuXG4gICAgICAgIC8vIFByZS1GaW5hbCB2YWx1ZXNcbiAgICAgICAgdmFyIFQwciA9IE1BciArIE1DcjtcbiAgICAgICAgdmFyIFQwaSA9IE1BaSArIE1DaTtcbiAgICAgICAgdmFyIFQxciA9IE1BciAtIE1DcjtcbiAgICAgICAgdmFyIFQxaSA9IE1BaSAtIE1DaTtcbiAgICAgICAgdmFyIFQyciA9IE1CciArIE1EcjtcbiAgICAgICAgdmFyIFQyaSA9IE1CaSArIE1EaTtcbiAgICAgICAgdmFyIFQzciA9IGludiAqIChNQnIgLSBNRHIpO1xuICAgICAgICB2YXIgVDNpID0gaW52ICogKE1CaSAtIE1EaSk7XG5cbiAgICAgICAgLy8gRmluYWwgdmFsdWVzXG4gICAgICAgIHZhciBGQXIgPSBUMHIgKyBUMnI7XG4gICAgICAgIHZhciBGQWkgPSBUMGkgKyBUMmk7XG5cbiAgICAgICAgdmFyIEZCciA9IFQxciArIFQzaTtcbiAgICAgICAgdmFyIEZCaSA9IFQxaSAtIFQzcjtcblxuICAgICAgICBvdXRbQV0gPSBGQXI7XG4gICAgICAgIG91dFtBICsgMV0gPSBGQWk7XG4gICAgICAgIG91dFtCXSA9IEZCcjtcbiAgICAgICAgb3V0W0IgKyAxXSA9IEZCaTtcblxuICAgICAgICAvLyBPdXRwdXQgZmluYWwgbWlkZGxlIHBvaW50XG4gICAgICAgIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgdmFyIEZDciA9IFQwciAtIFQycjtcbiAgICAgICAgICB2YXIgRkNpID0gVDBpIC0gVDJpO1xuICAgICAgICAgIG91dFtDXSA9IEZDcjtcbiAgICAgICAgICBvdXRbQyArIDFdID0gRkNpO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRG8gbm90IG92ZXJ3cml0ZSBvdXJzZWx2ZXNcbiAgICAgICAgaWYgKGkgPT09IGhxdWFydGVyTGVuKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIC8vIEluIHRoZSBmbGlwcGVkIGNhc2U6XG4gICAgICAgIC8vIE1BaSA9IC1NQWlcbiAgICAgICAgLy8gTUJyPS1NQmksIE1CaT0tTUJyXG4gICAgICAgIC8vIE1Dcj0tTUNyXG4gICAgICAgIC8vIE1Ecj1NRGksIE1EaT1NRHJcbiAgICAgICAgdmFyIFNUMHIgPSBUMXI7XG4gICAgICAgIHZhciBTVDBpID0gLVQxaTtcbiAgICAgICAgdmFyIFNUMXIgPSBUMHI7XG4gICAgICAgIHZhciBTVDFpID0gLVQwaTtcbiAgICAgICAgdmFyIFNUMnIgPSAtaW52ICogVDNpO1xuICAgICAgICB2YXIgU1QyaSA9IC1pbnYgKiBUM3I7XG4gICAgICAgIHZhciBTVDNyID0gLWludiAqIFQyaTtcbiAgICAgICAgdmFyIFNUM2kgPSAtaW52ICogVDJyO1xuXG4gICAgICAgIHZhciBTRkFyID0gU1QwciArIFNUMnI7XG4gICAgICAgIHZhciBTRkFpID0gU1QwaSArIFNUMmk7XG5cbiAgICAgICAgdmFyIFNGQnIgPSBTVDFyICsgU1QzaTtcbiAgICAgICAgdmFyIFNGQmkgPSBTVDFpIC0gU1QzcjtcblxuICAgICAgICB2YXIgU0EgPSBvdXRPZmYgKyBxdWFydGVyTGVuIC0gaTtcbiAgICAgICAgdmFyIFNCID0gb3V0T2ZmICsgaGFsZkxlbiAtIGk7XG5cbiAgICAgICAgb3V0W1NBXSA9IFNGQXI7XG4gICAgICAgIG91dFtTQSArIDFdID0gU0ZBaTtcbiAgICAgICAgb3V0W1NCXSA9IFNGQnI7XG4gICAgICAgIG91dFtTQiArIDFdID0gU0ZCaTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5cbi8vIHJhZGl4LTIgaW1wbGVtZW50YXRpb25cbi8vXG4vLyBOT1RFOiBPbmx5IGNhbGxlZCBmb3IgbGVuPTRcbkZGVC5wcm90b3R5cGUuX3NpbmdsZVJlYWxUcmFuc2Zvcm0yID0gZnVuY3Rpb24gX3NpbmdsZVJlYWxUcmFuc2Zvcm0yKG91dE9mZixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mZixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0ZXApIHtcbiAgY29uc3Qgb3V0ID0gdGhpcy5fb3V0O1xuICBjb25zdCBkYXRhID0gdGhpcy5fZGF0YTtcblxuICBjb25zdCBldmVuUiA9IGRhdGFbb2ZmXTtcbiAgY29uc3Qgb2RkUiA9IGRhdGFbb2ZmICsgc3RlcF07XG5cbiAgY29uc3QgbGVmdFIgPSBldmVuUiArIG9kZFI7XG4gIGNvbnN0IHJpZ2h0UiA9IGV2ZW5SIC0gb2RkUjtcblxuICBvdXRbb3V0T2ZmXSA9IGxlZnRSO1xuICBvdXRbb3V0T2ZmICsgMV0gPSAwO1xuICBvdXRbb3V0T2ZmICsgMl0gPSByaWdodFI7XG4gIG91dFtvdXRPZmYgKyAzXSA9IDA7XG59O1xuXG4vLyByYWRpeC00XG4vL1xuLy8gTk9URTogT25seSBjYWxsZWQgZm9yIGxlbj04XG5GRlQucHJvdG90eXBlLl9zaW5nbGVSZWFsVHJhbnNmb3JtNCA9IGZ1bmN0aW9uIF9zaW5nbGVSZWFsVHJhbnNmb3JtNChvdXRPZmYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGVwKSB7XG4gIGNvbnN0IG91dCA9IHRoaXMuX291dDtcbiAgY29uc3QgZGF0YSA9IHRoaXMuX2RhdGE7XG4gIGNvbnN0IGludiA9IHRoaXMuX2ludiA/IC0xIDogMTtcbiAgY29uc3Qgc3RlcDIgPSBzdGVwICogMjtcbiAgY29uc3Qgc3RlcDMgPSBzdGVwICogMztcblxuICAvLyBPcmlnaW5hbCB2YWx1ZXNcbiAgY29uc3QgQXIgPSBkYXRhW29mZl07XG4gIGNvbnN0IEJyID0gZGF0YVtvZmYgKyBzdGVwXTtcbiAgY29uc3QgQ3IgPSBkYXRhW29mZiArIHN0ZXAyXTtcbiAgY29uc3QgRHIgPSBkYXRhW29mZiArIHN0ZXAzXTtcblxuICAvLyBQcmUtRmluYWwgdmFsdWVzXG4gIGNvbnN0IFQwciA9IEFyICsgQ3I7XG4gIGNvbnN0IFQxciA9IEFyIC0gQ3I7XG4gIGNvbnN0IFQyciA9IEJyICsgRHI7XG4gIGNvbnN0IFQzciA9IGludiAqIChCciAtIERyKTtcblxuICAvLyBGaW5hbCB2YWx1ZXNcbiAgY29uc3QgRkFyID0gVDByICsgVDJyO1xuXG4gIGNvbnN0IEZCciA9IFQxcjtcbiAgY29uc3QgRkJpID0gLVQzcjtcblxuICBjb25zdCBGQ3IgPSBUMHIgLSBUMnI7XG5cbiAgY29uc3QgRkRyID0gVDFyO1xuICBjb25zdCBGRGkgPSBUM3I7XG5cbiAgb3V0W291dE9mZl0gPSBGQXI7XG4gIG91dFtvdXRPZmYgKyAxXSA9IDA7XG4gIG91dFtvdXRPZmYgKyAyXSA9IEZCcjtcbiAgb3V0W291dE9mZiArIDNdID0gRkJpO1xuICBvdXRbb3V0T2ZmICsgNF0gPSBGQ3I7XG4gIG91dFtvdXRPZmYgKyA1XSA9IDA7XG4gIG91dFtvdXRPZmYgKyA2XSA9IEZEcjtcbiAgb3V0W291dE9mZiArIDddID0gRkRpO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gbmV4dFBvd2VyT2ZUd29cblxuZnVuY3Rpb24gbmV4dFBvd2VyT2ZUd28gKG4pIHtcbiAgaWYgKG4gPT09IDApIHJldHVybiAxXG4gIG4tLVxuICBuIHw9IG4gPj4gMVxuICBuIHw9IG4gPj4gMlxuICBuIHw9IG4gPj4gNFxuICBuIHw9IG4gPj4gOFxuICBuIHw9IG4gPj4gMTZcbiAgcmV0dXJuIG4rMVxufSIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcblxuZnVuY3Rpb24gX2ludGVyb3BEZWZhdWx0IChleCkgeyByZXR1cm4gKGV4ICYmICh0eXBlb2YgZXggPT09ICdvYmplY3QnKSAmJiAnZGVmYXVsdCcgaW4gZXgpID8gZXhbJ2RlZmF1bHQnXSA6IGV4OyB9XG5cbnZhciBGRlQgPSBfaW50ZXJvcERlZmF1bHQocmVxdWlyZSgnZmZ0LmpzJykpO1xudmFyIG5leHRQT1QgPSBfaW50ZXJvcERlZmF1bHQocmVxdWlyZSgnbmV4dC1wb3dlci1vZi10d28nKSk7XG5cbmZ1bmN0aW9uIGRpcmVjdENvbnZvbHV0aW9uKGlucHV0LCBrZXJuZWwpIHtcbiAgICBjb25zdCBsZW5ndGggPSBpbnB1dC5sZW5ndGggKyBrZXJuZWwubGVuZ3RoIC0gMTtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBvdXRwdXQuZmlsbCgwKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwga2VybmVsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBvdXRwdXRbaSArIGpdICs9IGlucHV0W2ldICoga2VybmVsW2pdO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG59XG5cbmZ1bmN0aW9uIGZmdENvbnZvbHV0aW9uKGlucHV0LCBrZXJuZWwpIHtcbiAgICBjb25zdCByZXN1bHRMZW5ndGggPSBpbnB1dC5sZW5ndGggKyBrZXJuZWwubGVuZ3RoIC0gMTtcbiAgICBjb25zdCBmZnRMZW5ndGggPSBuZXh0UE9UKHJlc3VsdExlbmd0aCk7XG5cbiAgICBjb25zdCBmZnQgPSBuZXcgRkZUKGZmdExlbmd0aCk7XG5cbiAgICBjb25zdCB7b3V0cHV0OiBmZnRLZXJuZWwsIGlucHV0OiByZXN1bHR9ID0gY3JlYXRlUGFkZGVkRkZ0KGtlcm5lbCwgZmZ0LCBmZnRMZW5ndGgpO1xuICAgIGNvbnN0IHtvdXRwdXQ6IGZmdElucHV0fSA9IGNyZWF0ZVBhZGRlZEZGdChpbnB1dCwgZmZ0LCBmZnRMZW5ndGgpO1xuXG4gICAgLy8gcmV1c2UgYXJyYXlzXG4gICAgY29uc3QgZmZ0Q29udiA9IGZmdElucHV0O1xuICAgIGNvbnN0IGNvbnYgPSBmZnRLZXJuZWw7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmZnRDb252Lmxlbmd0aDsgaSArPSAyKSB7XG4gICAgICAgIGNvbnN0IHRtcCA9IGZmdElucHV0W2ldICogZmZ0S2VybmVsW2ldIC0gZmZ0SW5wdXRbaSArIDFdICogZmZ0S2VybmVsW2kgKyAxXTtcbiAgICAgICAgZmZ0Q29udltpICsgMV0gPSBmZnRJbnB1dFtpXSAqIGZmdEtlcm5lbFtpICsgMV0gKyBmZnRJbnB1dFtpICsgMV0gKiBmZnRLZXJuZWxbaV07XG4gICAgICAgIGZmdENvbnZbaV0gPSB0bXA7XG4gICAgfVxuICAgIGZmdC5pbnZlcnNlVHJhbnNmb3JtKGNvbnYsIGZmdENvbnYpO1xuICAgIHJldHVybiBmZnQuZnJvbUNvbXBsZXhBcnJheShjb252LCByZXN1bHQpLnNsaWNlKDAsIHJlc3VsdExlbmd0aCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVBhZGRlZEZGdChkYXRhLCBmZnQsIGxlbmd0aCkge1xuICAgIGNvbnN0IGlucHV0ID0gbmV3IEFycmF5KGxlbmd0aCk7XG4gICAgdmFyIGkgPSAwO1xuICAgIGZvciAoOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpbnB1dFtpXSA9IGRhdGFbaV07XG4gICAgfVxuICAgIGZvciAoO2kgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpbnB1dFtpXSA9IDA7XG4gICAgfVxuICAgIGNvbnN0IGZmdElucHV0ID0gZmZ0LnRvQ29tcGxleEFycmF5KGlucHV0KTtcbiAgICBjb25zdCBvdXRwdXQgPSBmZnQuY3JlYXRlQ29tcGxleEFycmF5KCk7XG4gICAgZmZ0LnRyYW5zZm9ybShvdXRwdXQsIGZmdElucHV0KTtcbiAgICByZXR1cm4ge1xuICAgICAgICBvdXRwdXQsXG4gICAgICAgIGlucHV0LFxuICAgICAgICBmZnRJbnB1dFxuICAgIH07XG59XG5cbmV4cG9ydHMuZGlyZWN0Q29udm9sdXRpb24gPSBkaXJlY3RDb252b2x1dGlvbjtcbmV4cG9ydHMuZmZ0Q29udm9sdXRpb24gPSBmZnRDb252b2x1dGlvbjtcbiJdfQ==

export default r('ml-convolution')
