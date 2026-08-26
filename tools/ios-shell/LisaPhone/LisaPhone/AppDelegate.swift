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

  // 真声通话:网页(正式站)请求麦克风时直接放行——系统级麦克风授权仍由 iOS 首次弹窗把关,
  // 这里只是免去 WKWebView 每次通话都再弹一层网页级询问。
  @available(iOS 15.0, *)
  func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
    decisionHandler(.grant)
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    // 静音保活的资格证:playback 类别 + mixWithOthers,不抢别的 app 的声音
    // 真声通话(2026-08-25)要录音:.playback 只出不进,换 .playAndRecord;
    // defaultToSpeaker=通话外放不憋听筒,mixWithOthers 保住静音保活不抢别家声音
    try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
    let cfg = WKWebViewConfiguration()
    cfg.allowsInlineMediaPlayback = true
    cfg.mediaTypesRequiringUserActionForPlayback = []
    cfg.websiteDataStore = .default()   // localStorage/IndexedDB 持久化,和 Safari 分开的独立小家
    // 自拍双写保险仓：网页照常写 IndexedDB，同时把像素镜像到 App 的 Application Support。
    // iOS 偶发清掉 WKWebView 网站数据时，网页可通过同一 bridge 自动补回。
    cfg.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "nativeMedia")
    // 自定义图像站通常不开放 WebView CORS。只代发用户明确配置的 HTTPS 请求，
    // 让模型列表和图片 API 能像 curl 一样工作；API key 不再交给跨域浏览器请求。
    cfg.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "nativeHttp")
    // 网页的 <a download> 在 WKWebView 里常被静默吃掉。审计/备份等文本文件统一交给
    // 系统分享面板，用户可存到“文件”、隔空投送或发给其它 App。
    cfg.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "nativeExport")
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
    // （真声通话麦克风放行见下方 requestMediaCapturePermissionFor 代理方法）
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
    if message.name == "nativeExport" {
      handleNativeExport(message.body, replyHandler: replyHandler)
      return
    }
    if message.name == "nativeHttp" {
      handleNativeHttp(message.body, replyHandler: replyHandler)
      return
    }
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

  private func handleNativeExport(_ rawBody: Any,
                                  replyHandler: @escaping (Any?, String?) -> Void) {
    guard let body = rawBody as? [String: Any],
          let rawName = body["filename"] as? String,
          let text = body["text"] as? String,
          !rawName.isEmpty, rawName.count <= 180 else {
      replyHandler(["ok": false, "error": "bad_export_request"], nil); return
    }
    var filename = URL(fileURLWithPath: rawName).lastPathComponent
    filename = filename.replacingOccurrences(of: ":", with: "-")
    guard !filename.isEmpty else {
      replyHandler(["ok": false, "error": "bad_filename"], nil); return
    }
    do {
      let dir = FileManager.default.temporaryDirectory.appendingPathComponent("LisaPhoneExports", isDirectory: true)
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let url = dir.appendingPathComponent(filename)
      try Data(text.utf8).write(to: url, options: .atomic)
      DispatchQueue.main.async { [weak self] in
        guard let self else { replyHandler(["ok": false, "error": "view_closed"], nil); return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let popover = sheet.popoverPresentationController {
          popover.sourceView = self.view
          popover.sourceRect = CGRect(x: self.view.bounds.midX, y: self.view.bounds.midY, width: 1, height: 1)
        }
        self.present(sheet, animated: true)
        replyHandler(["ok": true], nil)
      }
    } catch {
      replyHandler(["ok": false, "error": "export_write_failed"], nil)
    }
  }

  private func handleNativeHttp(_ rawBody: Any,
                                replyHandler: @escaping (Any?, String?) -> Void) {
    guard let body = rawBody as? [String: Any],
          let urlText = body["url"] as? String,
          let url = URL(string: urlText),
          url.scheme?.lowercased() == "https",
          url.host != nil else {
      replyHandler(["error": "only_https_urls_are_allowed"], nil); return
    }
    var request = URLRequest(url: url)
    request.httpMethod = (body["method"] as? String) ?? "GET"
    let timeoutMs = (body["timeoutMs"] as? NSNumber)?.doubleValue ?? 180000
    request.timeoutInterval = min(max(timeoutMs / 1000.0, 5), 300)
    if let headers = body["headers"] as? [String: Any] {
      for (name, value) in headers { request.setValue(String(describing: value), forHTTPHeaderField: name) }
    }
    if let text = body["body"] as? String, !text.isEmpty { request.httpBody = Data(text.utf8) }
    URLSession.shared.dataTask(with: request) { data, response, error in
      if let error {
        replyHandler(["error": error.localizedDescription], nil); return
      }
      guard let http = response as? HTTPURLResponse else {
        replyHandler(["error": "non_http_response"], nil); return
      }
      var headers: [String: String] = [:]
      for (key, value) in http.allHeaderFields { headers[String(describing: key)] = String(describing: value) }
      let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
      replyHandler(["status": http.statusCode, "headers": headers, "text": text], nil)
    }.resume()
  }

  override var prefersStatusBarHidden: Bool { false }
}
