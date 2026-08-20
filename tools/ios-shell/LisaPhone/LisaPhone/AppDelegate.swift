// Lisa-phone 原生壳 v1(2026-08-20,七天续签方案):WKWebView 全屏装载 GitHub Pages 正式站。
// 目的:摆脱 Safari PWA 的后台限制,让 app 有自己的进程与图标;推送仍走 Web Push(站内已有)。
import UIKit
import WebKit

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

class ShellViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
  var webView: WKWebView!
  let home = URL(string: "https://milkbun5472.github.io/milkbun-app/index.html")!

  override func viewDidLoad() {
    super.viewDidLoad()
    let cfg = WKWebViewConfiguration()
    cfg.allowsInlineMediaPlayback = true
    cfg.mediaTypesRequiringUserActionForPlayback = []
    cfg.websiteDataStore = .default()   // localStorage/IndexedDB 持久化,和 Safari 分开的独立小家
    if #available(iOS 16.4, *) { cfg.preferences.isElementFullscreenEnabled = true }
    webView = WKWebView(frame: .zero, configuration: cfg)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.scrollView.contentInsetAdjustmentBehavior = .never // 站内自己处理安全区
    webView.scrollView.bounces = false
    webView.allowsBackForwardNavigationGestures = true
    if #available(iOS 16.4, *) { webView.isInspectable = true } // 连 Mac Safari 可调试
    view.addSubview(webView)
    webView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      webView.topAnchor.constraint(equalTo: view.topAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])
    webView.load(URLRequest(url: home))
  }

  // 断网/加载失败:给一句人话+三秒后自动重试,别白屏
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { retrySoon() }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { retrySoon() }
  private func retrySoon() {
    webView.loadHTMLString("<meta name=viewport content='width=device-width,initial-scale=1'><body style='display:flex;align-items:center;justify-content:center;height:96vh;font-family:-apple-system;background:#ece8e1;color:#6b6257'>断网了,三秒后自己重试…</body>", baseURL: nil)
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
      guard let self else { return }
      self.webView.load(URLRequest(url: self.home))
    }
  }
  // window.open / target=_blank 一律留在本窗
  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
               for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = navigationAction.request.url { webView.load(URLRequest(url: url)) }
    return nil
  }
  override var prefersStatusBarHidden: Bool { false }
}
