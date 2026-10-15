#import <Cocoa/Cocoa.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <WebKit/WebKit.h>
#include <stdio.h>
#include <stdlib.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    [self buildMenu];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    config.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
    [config.userContentController addScriptMessageHandler:self name:@"native"];
    [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];

    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:config];
    self.webView.UIDelegate = self;
    self.webView.navigationDelegate = self;
    [self.webView setValue:@NO forKey:@"drawsBackground"];

    self.window = [[NSWindow alloc]
        initWithContentRect:NSMakeRect(0, 0, 1400, 860)
        styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                  NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable |
                  NSWindowStyleMaskFullSizeContentView
        backing:NSBackingStoreBuffered
        defer:NO
    ];
    self.window.title = @"SVG Forge 3D";
    self.window.titleVisibility = NSWindowTitleHidden;
    self.window.titlebarAppearsTransparent = YES;
    self.window.movableByWindowBackground = NO;
    self.window.backgroundColor = [NSColor colorWithCalibratedRed:0.047 green:0.055 blue:0.078 alpha:1];
    self.window.minSize = NSMakeSize(1050, 680);
    self.window.contentView = self.webView;
    [self.window center];
    [self.window makeKeyAndOrderFront:nil];

    NSURL *resourceURL = NSBundle.mainBundle.resourceURL;
    if (resourceURL == nil) {
        [self showError:@"The app resources could not be found."];
        return;
    }
    NSURL *webDirectory = [resourceURL URLByAppendingPathComponent:@"Web" isDirectory:YES];
    NSURL *indexURL = [webDirectory URLByAppendingPathComponent:@"index.html"];
    [self.webView loadFileURL:indexURL allowingReadAccessToURL:webDirectory];
    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)buildMenu {
    NSMenu *mainMenu = [[NSMenu alloc] init];

    NSMenuItem *appItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:appItem];
    NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"SVG Forge 3D"];
    [appMenu addItemWithTitle:@"About SVG Forge 3D"
                       action:@selector(orderFrontStandardAboutPanel:)
                keyEquivalent:@""];
    [appMenu addItem:NSMenuItem.separatorItem];
    [appMenu addItemWithTitle:@"Hide SVG Forge 3D" action:@selector(hide:) keyEquivalent:@"h"];
    NSMenuItem *hideOthers = [appMenu addItemWithTitle:@"Hide Others"
                                               action:@selector(hideOtherApplications:)
                                        keyEquivalent:@"h"];
    hideOthers.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagOption;
    [appMenu addItemWithTitle:@"Show All" action:@selector(unhideAllApplications:) keyEquivalent:@""];
    [appMenu addItem:NSMenuItem.separatorItem];
    [appMenu addItemWithTitle:@"Quit SVG Forge 3D" action:@selector(terminate:) keyEquivalent:@"q"];
    appItem.submenu = appMenu;

    NSMenuItem *editItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:editItem];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Edit"];
    [editMenu addItemWithTitle:@"Undo" action:@selector(undo:) keyEquivalent:@"z"];
    NSMenuItem *redo = [editMenu addItemWithTitle:@"Redo" action:@selector(redo:) keyEquivalent:@"Z"];
    redo.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagShift;
    [editMenu addItem:NSMenuItem.separatorItem];
    [editMenu addItemWithTitle:@"Cut" action:@selector(cut:) keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"Copy" action:@selector(copy:) keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"Paste" action:@selector(paste:) keyEquivalent:@"v"];
    [editMenu addItemWithTitle:@"Select All" action:@selector(selectAll:) keyEquivalent:@"a"];
    editItem.submenu = editMenu;

    NSMenuItem *windowItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:windowItem];
    NSMenu *windowMenu = [[NSMenu alloc] initWithTitle:@"Window"];
    [windowMenu addItemWithTitle:@"Minimize" action:@selector(performMiniaturize:) keyEquivalent:@"m"];
    [windowMenu addItemWithTitle:@"Zoom" action:@selector(performZoom:) keyEquivalent:@""];
    [windowMenu addItem:NSMenuItem.separatorItem];
    [windowMenu addItemWithTitle:@"Bring All to Front" action:@selector(arrangeInFront:) keyEquivalent:@""];
    windowItem.submenu = windowMenu;
    NSApp.windowsMenu = windowMenu;

    NSApp.mainMenu = mainMenu;
}

- (void)userContentController:(WKUserContentController *)userContentController
      didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.name isEqualToString:@"native"] || ![message.body isKindOfClass:NSDictionary.class]) {
        return;
    }
    NSDictionary *body = (NSDictionary *)message.body;
    NSString *type = body[@"type"];

    if ([type isEqualToString:@"saveText"]) {
        NSString *content = body[@"content"];
        NSString *filename = body[@"filename"];
        if ([content isKindOfClass:NSString.class] && [filename isKindOfClass:NSString.class]) {
            NSData *data = [content dataUsingEncoding:NSUTF8StringEncoding];
            [self saveData:data suggestedFilename:filename];
        }
    } else if ([type isEqualToString:@"saveBase64"]) {
        NSString *base64 = body[@"base64"];
        NSString *filename = body[@"filename"];
        if ([base64 isKindOfClass:NSString.class] && [filename isKindOfClass:NSString.class]) {
            NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 options:0];
            if (data != nil) [self saveData:data suggestedFilename:filename];
        }
    } else if ([type isEqualToString:@"copyText"]) {
        NSString *content = body[@"content"];
        if ([content isKindOfClass:NSString.class]) {
            [NSPasteboard.generalPasteboard clearContents];
            [NSPasteboard.generalPasteboard setString:content forType:NSPasteboardTypeString];
        }
    }
}

- (void)saveData:(NSData *)data suggestedFilename:(NSString *)filename {
    NSSavePanel *panel = [NSSavePanel savePanel];
    panel.nameFieldStringValue = filename;
    panel.canCreateDirectories = YES;
    panel.extensionHidden = NO;
    NSString *extension = filename.pathExtension.lowercaseString;
    if ([extension isEqualToString:@"svg"]) panel.allowedContentTypes = @[UTTypeSVG];
    if ([extension isEqualToString:@"png"]) panel.allowedContentTypes = @[UTTypePNG];

    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        if (result != NSModalResponseOK || panel.URL == nil) return;
        NSError *error = nil;
        if (![data writeToURL:panel.URL options:NSDataWritingAtomic error:&error]) {
            [self showError:[NSString stringWithFormat:@"The file couldn’t be saved.\n\n%@",
                                                       error.localizedDescription]];
        }
    }];
}

- (void)webView:(WKWebView *)webView
runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters
initiatedByFrame:(WKFrameInfo *)frame
completionHandler:(void (^)(NSArray<NSURL *> * _Nullable URLs))completionHandler {
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseFiles = YES;
    panel.canChooseDirectories = NO;
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection;
    panel.allowedContentTypes = @[UTTypeSVG];
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        completionHandler(result == NSModalResponseOK ? panel.URLs : nil);
    }];
}

- (void)webView:(WKWebView *)webView
didFailNavigation:(WKNavigation *)navigation
      withError:(NSError *)error {
    [self showError:[NSString stringWithFormat:@"The editor couldn’t be opened.\n\n%@",
                                               error.localizedDescription]];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    if (getenv("SVG_FORGE_SELF_TEST") == NULL) return;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                   dispatch_get_main_queue(), ^{
        [webView callAsyncJavaScript:@"return await window.svgForge.selfTest();"
                           arguments:@{}
                             inFrame:nil
                      inContentWorld:WKContentWorld.pageWorld
                   completionHandler:^(id result, NSError *error) {
            if (error != nil) {
                fprintf(stderr, "SVG_FORGE_SELF_TEST_ERROR: %s\n", error.localizedDescription.UTF8String);
                [NSApp terminate:nil];
                return;
            }
            NSData *json = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
            NSString *text = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
            fprintf(stdout, "SVG_FORGE_SELF_TEST_OK: %s\n", text.UTF8String);
            fflush(stdout);
            [NSApp terminate:nil];
        }];
    });
}

- (void)showError:(NSString *)message {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"SVG Forge 3D";
    alert.informativeText = message;
    alert.alertStyle = NSAlertStyleCritical;
    [alert runModal];
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = NSApplication.sharedApplication;
        AppDelegate *delegate = [[AppDelegate alloc] init];
        app.delegate = delegate;
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        [app run];
    }
    return 0;
}
