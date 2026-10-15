import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let dir = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
for (name, size) in [("icon_16x16",16),("icon_16x16@2x",32),("icon_32x32",32),("icon_32x32@2x",64),("icon_128x128",128),("icon_128x128@2x",256),("icon_256x256",256),("icon_256x256@2x",512),("icon_512x512",512),("icon_512x512@2x",1024)] {
    let ctx=CGContext(data:nil,width:size,height:size,bitsPerComponent:8,bytesPerRow:size*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.scaleBy(x:CGFloat(size)/1024,y:CGFloat(size)/1024)
    let rect=CGRect(x:35,y:35,width:954,height:954)
    let boundary=CGPath(roundedRect:rect,cornerWidth:208,cornerHeight:208,transform:nil)
    ctx.addPath(boundary);ctx.clip()
    let gradient=CGGradient(colorsSpace:CGColorSpace(name:CGColorSpace.sRGB),colors:[CGColor(red:0.12,green:0.19,blue:0.19,alpha:1),CGColor(red:0.025,green:0.04,blue:0.05,alpha:1)] as CFArray,locations:[0,1])!
    ctx.drawLinearGradient(gradient,start:CGPoint(x:0,y:1024),end:CGPoint(x:900,y:0),options:[])
    for y in 0..<11 { for x in 0..<11 {
        let dx=Double(x-5),dy=Double(y-5),r=hypot(dx,dy)
        let color: CGColor
        if r<1.6 {color=CGColor(red:0.025,green:0.05,blue:0.06,alpha:1)}
        else if r<2.8 {color=CGColor(red:0.52,green:0.91,blue:0.74,alpha:1)}
        else if r<4.8 && (abs(dx)<1.5 || abs(dy)<1.5 || abs(abs(dx)-abs(dy))<1.2) {color=CGColor(red:0.83,green:0.92,blue:0.86,alpha:1)}
        else {color=CGColor(red:0.22,green:0.37,blue:0.33,alpha:0.4)}
        ctx.setFillColor(color)
        ctx.addPath(CGPath(roundedRect:CGRect(x:209+x*56,y:209+y*56,width:48,height:48),cornerWidth:5,cornerHeight:5,transform:nil));ctx.fillPath()
    }}
    let image=ctx.makeImage()!,url=dir.appendingPathComponent(name+".png")
    let destination=CGImageDestinationCreateWithURL(url as CFURL,UTType.png.identifier as CFString,1,nil)!
    CGImageDestinationAddImage(destination,image,nil)
    precondition(CGImageDestinationFinalize(destination))
}
