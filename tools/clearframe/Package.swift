// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "Clearframe", platforms: [.macOS(.v14)], products: [.executable(name: "Clearframe", targets: ["Clearframe"])], targets: [.target(name: "ClearframeCore"), .executableTarget(name: "Clearframe", dependencies: ["ClearframeCore"]), .testTarget(name: "ClearframeCoreTests", dependencies: ["ClearframeCore"])])
