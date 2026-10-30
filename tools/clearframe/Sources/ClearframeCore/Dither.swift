import Foundation

public enum DitherAlgorithm: String, CaseIterable, Codable, Sendable {
  case off = "Off"
  case floyd = "Floyd–Steinberg"
  case atkinson = "Atkinson"
  case jarvis = "Jarvis–Judice–Ninke"
  case stucki = "Stucki"
  case burkes = "Burkes"
  case sierra3 = "Sierra 3"
  case sierra2 = "Sierra 2"
  case sierraLite = "Sierra Lite"
  case stevenson = "Stevenson–Arce"
  case bayer2 = "Bayer 2×2"
  case bayer4 = "Bayer 4×4"
  case bayer8 = "Bayer 8×8"
  case bayer16 = "Bayer 16×16"
  case halftone = "Halftone 8×8"
  case noise = "White noise"
  case threshold = "Threshold"
  public var hint: String {
    switch self {
    case .off: return "Original color, no quantization."
    case .atkinson: return "Classic Macintosh texture; crisp and high contrast."
    case .jarvis, .stucki: return "Broad error diffusion for smooth photographic gradients."
    case .bayer2, .bayer4, .bayer8, .bayer16:
      return "Stable geometric texture; a good choice for motion."
    case .halftone: return "Clustered dots inspired by newspaper printing."
    case .noise: return "Seeded random thresholds, consistent across frames."
    case .threshold: return "Hard quantization without error diffusion."
    default: return "Error diffusion preserves tone through fine pixel patterns."
    }
  }
}
public enum DitherPalette: String, CaseIterable, Codable, Sendable {
  case mono = "Ink / paper"
  case gray = "Grayscale · 8"
  case rgb8 = "RGB · 8"
  case rgb27 = "RGB · 27"
  case rgb64 = "RGB · 64"
  case rgb216 = "RGB · 216"
  case cobalt = "MLow · Cobalt"
  case gameboy = "Game Boy · 4"
  var levels: Int? {
    switch self {
    case .rgb8: return 2
    case .rgb27: return 3
    case .rgb64: return 4
    case .rgb216: return 6
    default: return nil
    }
  }
  var colors: [[Float]] {
    switch self {
    case .mono: return [[0, 0, 0], [255, 255, 255]]
    case .gray:
      return (0..<8).map {
        let v = Float($0) * 255 / 7
        return [v, v, v]
      }
    case .cobalt:
      return [
        [2, 4, 12], [6, 22, 58], [41, 98, 255], [0, 229, 255], [111, 35, 168], [240, 244, 248],
        [190, 133, 76], [255, 46, 99],
      ]
    case .gameboy: return [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]]
    default: return []
    }
  }
}
public enum Dither {
  typealias Tap = (Int, Int, Float)
  static func kernel(_ a: DitherAlgorithm) -> ([Tap], Float) {
    switch a {
    case .floyd: return ([(0, 1, 7), (1, -1, 3), (1, 0, 5), (1, 1, 1)], 16)
    case .atkinson: return ([(0, 1, 1), (0, 2, 1), (1, -1, 1), (1, 0, 1), (1, 1, 1), (2, 0, 1)], 8)
    case .jarvis:
      return (
        [
          (0, 1, 7), (0, 2, 5), (1, -2, 3), (1, -1, 5), (1, 0, 7), (1, 1, 5), (1, 2, 3), (2, -2, 1),
          (2, -1, 3), (2, 0, 5), (2, 1, 3), (2, 2, 1),
        ], 48
      )
    case .stucki:
      return (
        [
          (0, 1, 8), (0, 2, 4), (1, -2, 2), (1, -1, 4), (1, 0, 8), (1, 1, 4), (1, 2, 2), (2, -2, 1),
          (2, -1, 2), (2, 0, 4), (2, 1, 2), (2, 2, 1),
        ], 42
      )
    case .burkes:
      return ([(0, 1, 8), (0, 2, 4), (1, -2, 2), (1, -1, 4), (1, 0, 8), (1, 1, 4), (1, 2, 2)], 32)
    case .sierra3:
      return (
        [
          (0, 1, 5), (0, 2, 3), (1, -2, 2), (1, -1, 4), (1, 0, 5), (1, 1, 4), (1, 2, 2), (2, -1, 2),
          (2, 0, 3), (2, 1, 2),
        ], 32
      )
    case .sierra2:
      return ([(0, 1, 4), (0, 2, 3), (1, -2, 1), (1, -1, 2), (1, 0, 3), (1, 1, 2), (1, 2, 1)], 16)
    case .sierraLite: return ([(0, 1, 2), (1, -1, 1), (1, 0, 1)], 4)
    case .stevenson:
      return (
        [
          (0, 2, 32), (1, -3, 12), (1, -1, 26), (1, 1, 30), (1, 3, 16), (2, -2, 12), (2, 0, 26),
          (2, 2, 12), (2, 4, 5), (3, -3, 5), (3, -1, 12), (3, 1, 12), (3, 3, 5),
        ], 200
      )
    default: return ([], 1)
    }
  }
  static func matrix(_ a: DitherAlgorithm) -> (Int, [Float]) {
    if a == .halftone {
      return (
        8,
        [
          24, 10, 12, 26, 35, 47, 49, 37, 8, 0, 2, 14, 45, 59, 61, 51, 22, 6, 4, 16, 43, 57, 63, 53,
          30, 20, 18, 28, 33, 41, 55, 39, 34, 46, 48, 38, 25, 11, 13, 27, 44, 58, 60, 50, 9, 1, 3,
          15, 42, 56, 62, 52, 23, 7, 5, 17, 32, 40, 54, 36, 31, 21, 19, 29,
        ]
      )
    }
    let n: Int
    switch a {
    case .bayer2: n = 2
    case .bayer4: n = 4
    case .bayer8: n = 8
    case .bayer16: n = 16
    default: return (0, [])
    }
    var m: [Float] = [0]
    var size = 1
    while size < n {
      var next = [Float](repeating: 0, count: size * size * 4)
      for y in 0..<size {
        for x in 0..<size {
          let v = m[y * size + x] * 4
          next[y * size * 2 + x] = v
          next[y * size * 2 + x + size] = v + 2
          next[(y + size) * size * 2 + x] = v + 3
          next[(y + size) * size * 2 + x + size] = v + 1
        }
      }
      m = next
      size *= 2
    }
    return (n, m)
  }
  public static func apply(
    _ data: Data, width: Int, height: Int, algorithm: DitherAlgorithm, palette: DitherPalette,
    spread: Double = 64, seed: Int = 42
  ) throws -> Data {
    guard width > 0, height > 0, width <= 16384, height <= 16384, data.count == width * height * 4
    else { throw MediaError.message("Invalid RGBA frame dimensions.") }
    if algorithm == .off { return data }
    var pixels = [UInt8](data)
    let (taps, denom) = kernel(algorithm)
    let (n, m) = matrix(algorithm)
    // Four scanlines of error keep memory bounded even on large frames.
    var errors = [Float](repeating: 0, count: width * 4 * 3)
    let colors = palette.colors
    let levels = palette.levels
    var rng = UInt64(max(0, seed)) + 1
    for y in 0..<height {
      for x in 0..<width {
        let i = (y * width + x) * 4
        let e = ((y % 4) * width + x) * 3
        if pixels[i + 3] == 0 { continue }
        var r = Float(pixels[i])
        var g = Float(pixels[i + 1])
        var b = Float(pixels[i + 2])
        if palette == .mono || palette == .gray {
          let l = 0.2126 * r + 0.7152 * g + 0.0722 * b
          r = l
          g = l
          b = l
        }
        r += errors[e]
        g += errors[e + 1]
        b += errors[e + 2]
        var offset: Float = 0
        if n > 0 {
          offset =
            ((m[(y % n) * n + x % n] + 0.5) / Float(n * n) - 0.5)
            * Float(palette == .mono ? 255 : spread)
        }
        if algorithm == .noise {
          rng = rng &* 6_364_136_223_846_793_005 &+ 1
          offset =
            (Float((rng >> 32) & 65535) / 65535 - 0.5) * Float(palette == .mono ? 255 : spread)
        }
        let rr = r + offset
        let gg = g + offset
        let bb = b + offset
        let nr: Float
        let ng: Float
        let nb: Float
        if let levels {
          let step = 255 / Float(levels - 1)
          nr = max(0, min(255, (rr / step).rounded() * step))
          ng = max(0, min(255, (gg / step).rounded() * step))
          nb = max(0, min(255, (bb / step).rounded() * step))
        } else {
          var best = colors[0]
          var distance = Float.greatestFiniteMagnitude
          for c in colors {
            let d =
              (rr - c[0]) * (rr - c[0]) + (gg - c[1]) * (gg - c[1]) + (bb - c[2]) * (bb - c[2])
            if d < distance {
              distance = d
              best = c
            }
          }
          nr = best[0]
          ng = best[1]
          nb = best[2]
        }
        pixels[i] = UInt8(nr.rounded())
        pixels[i + 1] = UInt8(ng.rounded())
        pixels[i + 2] = UInt8(nb.rounded())
        for (dy, dx, weight) in taps {
          let xx = x + dx
          let yy = y + dy
          if xx >= 0 && xx < width && yy < height {
            let j = ((yy % 4) * width + xx) * 3
            let f = weight / denom
            errors[j] += (r - nr) * f
            errors[j + 1] += (g - ng) * f
            errors[j + 2] += (b - nb) * f
          }
        }
      }
      for j in (y % 4) * width * 3..<(y % 4 + 1) * width * 3 { errors[j] = 0 }
    }
    return Data(pixels)
  }
}
