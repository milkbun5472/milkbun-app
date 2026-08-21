// Lisa-phone 原生壳 v1(2026-08-20,七天续签方案):WKWebView 全屏装载 GitHub Pages 正式站。
// 目的:摆脱 Safari PWA 的后台限制,让 app 有自己的进程与图标;推送仍走 Web Push(站内已有)。
import UIKit
import WebKit
import AVFoundation

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  func application(_ application: UIApplication,
                   didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let w = UIWindow(frame: UIScreen.main.bounds)
    w.rootViewController = ShellViewController()
    w.makeKeyAndVisible()
    window = w
    return true
  }
}

class ShellViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
  var webView: WKWebView!
  let home = URL(string: "https://milkbun5472.github.io/milkbun-app/index.html")!

  // WKWebView 有自己的一层 HTTP 磁盘缓存，可能在 Service Worker 接手前就把旧 index.html 交回来。
  // 首页每次冷启动带一个只用于破缓存的时间戳；脚本本身仍用站内版本号缓存，既能更新也不重复囤积。
  private func homeRequest() -> URLRequest {
    var parts = URLComponents(url: home, resolvingAgainstBaseURL: false)!
    parts.queryItems = [URLQueryItem(name: "shell", value: String(Int(Date().timeIntervalSince1970)))]
    return URLRequest(url: parts.url!, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 30)
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    // 静音保活的资格证:playback 类别 + mixWithOthers,不抢别的 app 的声音
    try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
    let cfg = WKWebViewConfiguration()
    cfg.allowsInlineMediaPlayback = true
    cfg.mediaTypesRequiringUserActionForPlayback = []
    cfg.websiteDataStore = .default()   // localStorage/IndexedDB 持久化,和 Safari 分开的独立小家
    // 自拍双写保险仓：网页照常写 IndexedDB，同时把像素镜像到 App 的 Application Support。
    // iOS 偶发清掉 WKWebView 网站数据时，网页可通过同一 bridge 自动补回。
    cfg.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "nativeMedia")
    if #available(iOS 16.4, *) { cfg.preferences.isElementFullscreenEnabled = true }
    webView = WKWebView(frame: .zero, configuration: cfg)
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    // 全面屏铺满,env(safe-area-inset-*)在壳里本来就活;真凶是站内顶部垫片只认 standalone(书签)模式,
    // 这里把 navigator.standalone 报成 true,站就按 PWA 同一套排版走——壳与书签像素级一致(2026-08-20 三堂会审定案)
    let fakeStandalone = WKUserScript(source: "Object.defineProperty(navigator,'standalone',{get:function(){return true}});",
                                      injectionTime: .atDocumentStart, forMainFrameOnly: true)
    webView.configuration.userContentController.addUserScript(fakeStandalone)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    view.backgroundColor = UIColor(red: 0.925, green: 0.910, blue: 0.882, alpha: 1) // 站内米白,刘海区同色补齐
    webView.scrollView.bounces = false
    webView.allowsBackForwardNavigationGestures = true
    if #available(iOS 16.4, *) { webView.isInspectable = true } // 连 Mac Safari 可调试
    view.addSubview(webView)
    webView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: view.topAnchor),
      // 底部铺满到物理屏底:站内 dock 自带留白,壳再让就成双重垫底(2026-08-20 她第二次抓包)
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])
    webView.load(homeRequest())
  }

  // 后台被 iOS 杀掉 WebView 内容进程 → 回前台自动复活,别让她对着白屏(2026-08-21 她抓的「几秒就重置」)
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

  // 断网/加载失败:给一句人话+三秒后自动重试,别白屏
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { retrySoon() }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { retrySoon() }
  private func retrySoon() {
    webView.loadHTMLString("<meta name=viewport content='width=device-width,initial-scale=1'><body style='display:flex;align-items:center;justify-content:center;height:96vh;font-family:-apple-system;background:#ece8e1;color:#6b6257'>断网了,三秒后自己重试…</body>", baseURL: nil)
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
      guard let self else { return }
      self.webView.load(self.homeRequest())
    }
  }
  // window.open / target=_blank 一律留在本窗
  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
               for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = navigationAction.request.url { webView.load(URLRequest(url: url)) }
    return nil
  }

  private func mediaDirectory(_ bucket: String) throws -> URL {
    guard bucket == "selfies" else { throw NSError(domain: "LisaPhoneMedia", code: 1) }
    let root = try FileManager.default.url(for: .applicationSupportDirectory,
                                           in: .userDomainMask,
                                           appropriateFor: nil,
                                           create: true)
      .appendingPathComponent("LisaPhoneMedia", isDirectory: true)
      .appendingPathComponent(bucket, isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
  }

  private func safeMediaKey(_ value: String) -> String? {
    guard !value.isEmpty, value.count <= 180 else { return nil }
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-"))
    return value.unicodeScalars.allSatisfy { allowed.contains($0) } ? value : nil
  }

  private func mediaURLs(bucket: String, key: String) throws -> (URL, URL) {
    guard let safe = safeMediaKey(key) else { throw NSError(domain: "LisaPhoneMedia", code: 2) }
    let dir = try mediaDirectory(bucket)
    return (dir.appendingPathComponent(safe + ".bin"), dir.appendingPathComponent(safe + ".mime"))
  }

  func userContentController(_ userContentController: WKUserContentController,
                             didReceive message: WKScriptMessage,
                             replyHandler: @escaping (Any?, String?) -> Void) {
    guard let body = message.body as? [String: Any],
          let action = body["action"] as? String,
          let bucket = body["bucket"] as? String else {
      replyHandler(nil, "bad_request"); return
    }
    do {
      switch action {
      case "put":
        guard let key = body["key"] as? String,
              let dataURL = body["dataUrl"] as? String,
              let comma = dataURL.firstIndex(of: ","),
              dataURL.hasPrefix("data:"),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]), options: .ignoreUnknownCharacters)
        else { throw NSError(domain: "LisaPhoneMedia", code: 3) }
        let header = String(dataURL[..<comma])
        let mime = header.dropFirst(5).split(separator: ";", maxSplits: 1).first.map(String.init) ?? "application/octet-stream"
        let (binURL, mimeURL) = try mediaURLs(bucket: bucket, key: key)
        try data.write(to: binURL, options: .atomic)
        try Data(mime.utf8).write(to: mimeURL, options: .atomic)
        replyHandler(true, nil)
      case "get":
        guard let key = body["key"] as? String else { throw NSError(domain: "LisaPhoneMedia", code: 4) }
        let (binURL, mimeURL) = try mediaURLs(bucket: bucket, key: key)
        guard FileManager.default.fileExists(atPath: binURL.path) else { replyHandler(nil, nil); return }
        let data = try Data(contentsOf: binURL)
        let mime = (try? String(contentsOf: mimeURL, encoding: .utf8)) ?? "image/jpeg"
        replyHandler("data:\(mime);base64,\(data.base64EncodedString())", nil)
      case "delete":
        guard let key = body["key"] as? String else { throw NSError(domain: "LisaPhoneMedia", code: 5) }
        let (binURL, mimeURL) = try mediaURLs(bucket: bucket, key: key)
        try? FileManager.default.removeItem(at: binURL)
        try? FileManager.default.removeItem(at: mimeURL)
        replyHandler(true, nil)
      case "keys":
        let dir = try mediaDirectory(bucket)
        let names = try FileManager.default.contentsOfDirectory(atPath: dir.path)
          .filter { $0.hasSuffix(".bin") }
          .map { String($0.dropLast(4)) }
          .sorted()
        replyHandler(names, nil)
      default:
        replyHandler(nil, "unknown_action")
      }
    } catch {
      replyHandler(nil, "native_media_error_\((error as NSError).code)")
    }
  }

  override var prefersStatusBarHidden: Bool { false }
}
