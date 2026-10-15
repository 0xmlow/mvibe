import Foundation

struct CellLayer: Sendable {
    let name: String
    let pixels: [UInt32]
}

// Builds a new cell canvas in successive paint passes. Image samples guide
// color and direction; they are never copied cell-for-cell into the result.
enum CellPainter {
    struct RGB {
        var r: Double, g: Double, b: Double
        init(_ c: UInt32) { r = Double((c >> 16) & 255); g = Double((c >> 8) & 255); b = Double(c & 255) }
        init(_ r: Double, _ g: Double, _ b: Double) { self.r=r; self.g=g; self.b=b }
        var color: UInt32 { UInt32(max(0,min(255,Int(r.rounded())))) << 16 | UInt32(max(0,min(255,Int(g.rounded())))) << 8 | UInt32(max(0,min(255,Int(b.rounded())))) }
        var light: Double { r*0.30 + g*0.59 + b*0.11 }
        func distance(_ other: RGB) -> Double { (r-other.r)*(r-other.r)*0.30 + (g-other.g)*(g-other.g)*0.50 + (b-other.b)*(b-other.b)*0.20 }
    }
    static func blur(_ input: [RGB], _ w: Int, _ h: Int, _ radius: Int) -> [RGB] {
        var horizontal=input, result=input
        for y in 0..<h {
            var rr=0.0,gg=0.0,bb=0.0
            for x in -radius...radius { let c=input[y*w+max(0,min(w-1,x))];rr+=c.r;gg+=c.g;bb+=c.b }
            for x in 0..<w {
                let n=Double(radius*2+1);horizontal[y*w+x]=RGB(rr/n,gg/n,bb/n)
                let a=input[y*w+max(0,x-radius)],b=input[y*w+min(w-1,x+radius+1)]
                rr+=b.r-a.r;gg+=b.g-a.g;bb+=b.b-a.b
            }
        }
        for x in 0..<w {
            var rr=0.0,gg=0.0,bb=0.0
            for y in -radius...radius { let c=horizontal[max(0,min(h-1,y))*w+x];rr+=c.r;gg+=c.g;bb+=c.b }
            for y in 0..<h {
                let n=Double(radius*2+1);result[y*w+x]=RGB(rr/n,gg/n,bb/n)
                let a=horizontal[max(0,y-radius)*w+x],b=horizontal[min(h-1,y+radius+1)*w+x]
                rr+=b.r-a.r;gg+=b.g-a.g;bb+=b.b-a.b
            }
        }
        return result
    }
    static func palette(_ samples: [RGB], count: Int) -> [RGB] {
        var groups = [Array(stride(from:0,to:samples.count,by:max(1,samples.count/9000))).map { samples[$0] }]
        func range(_ list: [RGB]) -> (Double,Int) {
            var lo=[255.0,255.0,255.0],hi=[0.0,0.0,0.0]
            for c in list { for (i,v) in [c.r,c.g,c.b].enumerated() {lo[i]=min(lo[i],v);hi[i]=max(hi[i],v)} }
            let spans=(0..<3).map { hi[$0]-lo[$0] };let axis=spans.indices.max {spans[$0]<spans[$1]}!
            return (spans[axis],axis)
        }
        while groups.count < count {
            guard let i=groups.indices.filter({groups[$0].count>1}).max(by:{range(groups[$0]).0*sqrt(Double(groups[$0].count)) < range(groups[$1]).0*sqrt(Double(groups[$1].count))}) else {break}
            let (_,axis)=range(groups[i]);let ordered=groups.remove(at:i).sorted { [ $0.r,$0.g,$0.b ][axis] < [ $1.r,$1.g,$1.b ][axis] }
            groups.append(Array(ordered.prefix(ordered.count/2)));groups.append(Array(ordered.dropFirst(ordered.count/2)))
        }
        return groups.map { group in
            let n=Double(group.count);return RGB(group.reduce(0){$0+$1.r}/n,group.reduce(0){$0+$1.g}/n,group.reduce(0){$0+$1.b}/n)
        }.sorted {$0.light<$1.light}
    }
    static func paint(_ source: CellArtwork, settings: ExportSettings, cancel: CancellationFlag) throws -> CellArtwork {
        let w=source.width,h=source.height
        let rgb=source.pixels.map(RGB.init)
        let size=max(2,Int(Double(max(w,h))/90 * Double(settings.brushStrength)))
        let soft=blur(blur(rgb,w,h,max(1,size/3)),w,h,max(1,size/3))
        let broad=blur(soft,w,h,max(2,size))
        let luminanceOrder=rgb.sorted {$0.light<$1.light}
        var colors=palette(soft,count:settings.paintColors-3)
        colors.append(luminanceOrder[max(0,Int(Double(rgb.count)*0.001))])
        colors.append(luminanceOrder[min(rgb.count-1,Int(Double(rgb.count)*0.999))])
        let neutrals=rgb.filter { max($0.r,$0.g,$0.b)-min($0.r,$0.g,$0.b) < max($0.r,$0.g,$0.b)*0.45 }.sorted {$0.light>$1.light}.prefix(12)
        if neutrals.isEmpty {colors.append(luminanceOrder.last!)}
        else {let n=Double(neutrals.count);colors.append(RGB(neutrals.reduce(0){$0+$1.r}/n,neutrals.reduce(0){$0+$1.g}/n,neutrals.reduce(0){$0+$1.b}/n))}
        colors.sort {$0.light<$1.light}
        func nearest(_ c:RGB) -> Int { colors.indices.min {colors[$0].distance(c)<colors[$1].distance(c)}! }
        let dark=colors[0].color
        var canvas=[UInt32](repeating:dark,count:w*h)
        var seed:UInt64=5241
        func random() -> Double {seed=seed &* 6364136223846793005 &+ 1442695040888963407;return Double(seed>>33)/Double(1<<31)}
        func sample(_ field:[RGB],_ x:Double,_ y:Double) -> RGB {field[max(0,min(h-1,Int(y)))*w+max(0,min(w-1,Int(x)))]}
        func dab(_ cx:Double,_ cy:Double,_ rx:Double,_ ry:Double,_ angle:Double,_ color:UInt32) {
            let radius=Int(ceil(max(rx,ry)))+1,cs=cos(angle),sn=sin(angle)
            for y in max(0,Int(cy)-radius)...min(h-1,Int(cy)+radius) {
                for x in max(0,Int(cx)-radius)...min(w-1,Int(cx)+radius) {
                    let dx=Double(x)-cx,dy=Double(y)-cy,u=(dx*cs+dy*sn)/rx,v=(-dx*sn+dy*cs)/ry
                    // Angular shoulders leave visible cell brushwork, rather than a pixel filter.
                    if pow(abs(u),3)+pow(abs(v),3)<1 {canvas[y*w+x]=color}
                }
            }
        }
        // Underpainting: broad overlapping pigment masses.
        let coarse=max(3,size*2)
        for y in stride(from:0,to:h,by:coarse) {
            try cancel.check()
            for x in stride(from:0,to:w,by:coarse) {
                let cx=Double(x)+Double(coarse)*(0.25+random()*0.5),cy=Double(y)+Double(coarse)*(0.25+random()*0.5)
                dab(cx,cy,Double(coarse)*1.15,Double(coarse)*0.9,(random() - 0.5)*0.8,colors[nearest(sample(broad,cx,cy))].color)
            }
        }
        let underpainting=canvas
        // Direction follows broad image structures, while each pass repaints entire strokes.
        for pass in 0..<2 {
            let step=max(2,size/(pass+1)),radius=max(1.1,Double(size)*[0.78,0.42][pass])
            var points:[(Int,Int)]=[]
            for y in stride(from:0,to:h,by:step) {for x in stride(from:0,to:w,by:step) {points.append((x,y))}}
            if points.count>1 {for i in stride(from:points.count-1,through:1,by:-1) {points.swapAt(i,Int(random()*Double(i+1)))}}
            for (index,p) in points.enumerated() {
                if index%128==0 {try cancel.check()}
                let x=max(0,min(w-1,p.0+Int(random()*Double(step)))),y=max(0,min(h-1,p.1+Int(random()*Double(step))))
                let target=soft[y*w+x]
                if pass==1 && RGB(canvas[y*w+x]).distance(target)<160 {continue}
                let gx=sample(soft,Double(x+2),Double(y)).light-sample(soft,Double(x-2),Double(y)).light
                let gy=sample(soft,Double(x),Double(y+2)).light-sample(soft,Double(x),Double(y-2)).light
                let angle=hypot(gx,gy)>4 ? atan2(gy,gx)+Double.pi/2 : -0.35
                let pigment=colors[nearest(target)].color
                let length=radius*(2.2+random()*1.4)
                for t in stride(from:-length,to:length,by:0.8) {
                    let cx=Double(x)+cos(angle)*t,cy=Double(y)+sin(angle)*t
                    if cx<0 || cy<0 || cx>=Double(w) || cy>=Double(h) {continue}
                    if sample(soft,cx,cy).distance(target)>1100 {continue}
                    dab(cx,cy,radius*0.85,radius*0.62,angle,pigment)
                }
            }
        }
        let brushwork=canvas
        let detail=blur(rgb,w,h,1)
        // Small, high-contrast marks retain landmarks such as keys, eyes, or lettering
        // edges without returning to a one-cell-per-image-sample reconstruction.
        if w>4 && h>4 {
            for y in stride(from:2,to:h-2,by:2) {
                try cancel.check()
                for x in stride(from:2,to:w-2,by:2) {
                    let target=detail[y*w+x]
                    if target.light > max(65,broad[y*w+x].light+22) {
                        let gx=detail[y*w+x+1].light-detail[y*w+x-1].light,gy=detail[(y+1)*w+x].light-detail[(y-1)*w+x].light
                        let angle=atan2(gy,gx)+Double.pi/2
                        dab(Double(x),Double(y),1.5,0.7,angle,colors[nearest(target)].color)
                    }
                }
            }
        }
        // Selective dark contours articulate major boundaries, not every palette change.
        if w>4 && h>4 {
            for y in 2..<(h-2) {
                try cancel.check()
                for x in 2..<(w-2) {
                    let gx=soft[y*w+x+2].light-soft[y*w+x-2].light,gy=soft[(y+2)*w+x].light-soft[(y-2)*w+x].light
                    let magnitude=hypot(gx,gy)
                    if magnitude>48 && soft[y*w+x].light<55 && detail[y*w+x].light<55 {
                        let prior=RGB(canvas[y*w+x]);canvas[y*w+x]=colors[nearest(RGB(prior.r*0.52,prior.g*0.52,prior.b*0.52))].color
                    }
                }
            }
        }
        return CellArtwork(width:w,height:h,pixels:canvas,layers:[CellLayer(name:"Underpainting",pixels:underpainting),CellLayer(name:"Brushwork",pixels:brushwork)])
    }
}
