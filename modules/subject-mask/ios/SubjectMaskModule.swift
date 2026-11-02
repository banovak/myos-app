// Subject cutout, entirely on the phone: Vision's foreground instance mask
// (the same "lift subject" iOS uses in Photos) applied to a photo file,
// written out as a PNG with a transparent background, at the photo's full frame
// (not cropped to the subject), so a series stays comparable and lines up.
// Nothing leaves the device. iOS 17 and later; older phones get nil.
import ExpoModulesCore
import Vision
import CoreImage
import UIKit

public class SubjectMaskModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SubjectMask")

    Constants {
      var available = false
      if #available(iOS 17.0, *) { available = true }
      return ["available": available]
    }

    // file:// URI of a photo → file:// URI of the cutout PNG, same size as the photo, or nil when no subject is found
    AsyncFunction("cutout") { (uri: String) -> String? in
      guard #available(iOS 17.0, *) else { return nil }
      guard let url = URL(string: uri) else { throw BadUriException(uri) }
      let data = try Data(contentsOf: url)
      guard let image = UIImage(data: data), let cg = image.cgImage else { throw NotAnImageException() }

      let handler = VNImageRequestHandler(cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation), options: [:])
      let request = VNGenerateForegroundInstanceMaskRequest()
      try handler.perform([request])
      guard let result = request.results?.first, !result.allInstances.isEmpty else { return nil }

      let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
      let ci = CIImage(cvPixelBuffer: buffer)
      let context = CIContext()
      guard let png = context.pngRepresentation(of: ci, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB()) else { return nil }

      let out = FileManager.default.temporaryDirectory.appendingPathComponent("cutout-\(UUID().uuidString).png")
      try png.write(to: out)
      return out.absoluteString
    }
  }
}

internal final class BadUriException: GenericException<String> {
  override var reason: String { "Not a file URI: \(param)" }
}
internal final class NotAnImageException: Exception {
  override var reason: String { "The file is not an image this phone can decode" }
}

extension CGImagePropertyOrientation {
  init(_ o: UIImage.Orientation) {
    switch o {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
