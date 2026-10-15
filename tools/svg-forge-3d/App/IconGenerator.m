#import <Cocoa/Cocoa.h>

static NSBezierPath *roundedPolygon(NSPoint points[], NSInteger count, CGFloat radius) {
    NSBezierPath *path = [NSBezierPath bezierPath];
    for (NSInteger i = 0; i < count; i++) {
        NSPoint current = points[i];
        NSPoint previous = points[(i - 1 + count) % count];
        NSPoint next = points[(i + 1) % count];
        NSPoint start = NSMakePoint(
            current.x + (previous.x - current.x) * radius,
            current.y + (previous.y - current.y) * radius
        );
        NSPoint end = NSMakePoint(
            current.x + (next.x - current.x) * radius,
            current.y + (next.y - current.y) * radius
        );
        if (i == 0) [path moveToPoint:start];
        else [path lineToPoint:start];
        [path curveToPoint:end controlPoint1:current controlPoint2:current];
    }
    [path closePath];
    return path;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc < 2) return 1;
        const NSInteger size = 1024;
        NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc]
            initWithBitmapDataPlanes:NULL
            pixelsWide:size
            pixelsHigh:size
            bitsPerSample:8
            samplesPerPixel:4
            hasAlpha:YES
            isPlanar:NO
            colorSpaceName:NSCalibratedRGBColorSpace
            bitmapFormat:0
            bytesPerRow:0
            bitsPerPixel:0
        ];
        NSGraphicsContext *context = [NSGraphicsContext graphicsContextWithBitmapImageRep:bitmap];
        [NSGraphicsContext saveGraphicsState];
        NSGraphicsContext.currentContext = context;
        [NSColor.clearColor setFill];
        NSRectFill(NSMakeRect(0, 0, size, size));

        NSShadow *shadow = [[NSShadow alloc] init];
        shadow.shadowColor = [NSColor colorWithCalibratedWhite:0 alpha:.38];
        shadow.shadowBlurRadius = 48;
        shadow.shadowOffset = NSMakeSize(0, -26);
        [shadow set];

        NSBezierPath *tile = [NSBezierPath bezierPathWithRoundedRect:NSMakeRect(72, 72, 880, 880)
                                                            xRadius:210 yRadius:210];
        NSGradient *tileGradient = [[NSGradient alloc]
            initWithColors:@[
                [NSColor colorWithCalibratedRed:.66 green:.35 blue:1 alpha:1],
                [NSColor colorWithCalibratedRed:.36 green:.16 blue:.91 alpha:1],
                [NSColor colorWithCalibratedRed:.93 green:.19 blue:.59 alpha:1]
            ]
            atLocations:(CGFloat[]){0, .58, 1}
            colorSpace:NSColorSpace.sRGBColorSpace
        ];
        [tileGradient drawInBezierPath:tile angle:-52];
        shadow.shadowColor = NSColor.clearColor;
        [shadow set];

        NSBezierPath *glow = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(100, 512, 650, 470)];
        [[NSColor colorWithCalibratedRed:1 green:.75 blue:1 alpha:.16] setFill];
        [glow fill];

        NSPoint backPoints[] = {
            NSMakePoint(512, 758), NSMakePoint(756, 620), NSMakePoint(756, 348),
            NSMakePoint(512, 210), NSMakePoint(268, 348), NSMakePoint(268, 620)
        };
        NSBezierPath *back = roundedPolygon(backPoints, 6, .055);
        [[NSColor colorWithCalibratedRed:.18 green:.07 blue:.47 alpha:.62] setFill];
        [back fill];

        NSPoint frontPoints[] = {
            NSMakePoint(474, 804), NSMakePoint(718, 666), NSMakePoint(718, 394),
            NSMakePoint(474, 256), NSMakePoint(230, 394), NSMakePoint(230, 666)
        };
        NSBezierPath *front = roundedPolygon(frontPoints, 6, .055);
        NSGradient *frontGradient = [[NSGradient alloc]
            initWithStartingColor:[NSColor colorWithCalibratedWhite:1 alpha:1]
            endingColor:[NSColor colorWithCalibratedRed:.76 green:.74 blue:1 alpha:1]
        ];
        [frontGradient drawInBezierPath:front angle:-65];

        NSPoint innerPoints[] = {
            NSMakePoint(474, 675), NSMakePoint(608, 598), NSMakePoint(608, 448),
            NSMakePoint(474, 371), NSMakePoint(340, 448), NSMakePoint(340, 598)
        };
        NSBezierPath *inner = roundedPolygon(innerPoints, 6, .08);
        [[NSColor colorWithCalibratedRed:.39 green:.20 blue:.92 alpha:1] setFill];
        [inner fill];

        NSBezierPath *spark = [NSBezierPath bezierPath];
        [spark moveToPoint:NSMakePoint(510, 646)];
        [spark lineToPoint:NSMakePoint(392, 512)];
        [spark lineToPoint:NSMakePoint(476, 512)];
        [spark lineToPoint:NSMakePoint(452, 407)];
        [spark lineToPoint:NSMakePoint(566, 548)];
        [spark lineToPoint:NSMakePoint(486, 548)];
        [spark closePath];
        [[NSColor colorWithCalibratedRed:1 green:.35 blue:.68 alpha:1] setFill];
        [spark fill];

        [NSGraphicsContext restoreGraphicsState];
        NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
        NSString *path = [NSString stringWithUTF8String:argv[1]];
        return [png writeToFile:path atomically:YES] ? 0 : 2;
    }
}
