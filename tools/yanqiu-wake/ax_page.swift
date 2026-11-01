import Cocoa
import ApplicationServices

// Read-only bridge for CFURL-valued AXURL, which System Events cannot marshal.
let target = CommandLine.arguments.count == 2 ? CommandLine.arguments[1] : ""
guard target.range(of: "^local_[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$", options: .regularExpression) != nil else { exit(2) }
guard AXIsProcessTrusted() else { print("{\"status\":\"permission_required\"}"); exit(0) }
let apps = NSRunningApplication.runningApplications(withBundleIdentifier: "com.anthropic.claudefordesktop")
guard apps.count == 1 else { print("{\"status\":\"wrong_window\"}"); exit(0) }
let app = AXUIElementCreateApplication(apps[0].processIdentifier)
AXUIElementSetMessagingTimeout(app, 2)
AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
func attribute(_ element: AXUIElement, _ key: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, key as CFString, &value) == .success ? value : nil
}
func children(_ element: AXUIElement) -> [AXUIElement] {
    return attribute(element, "AXChildren") as? [AXUIElement] ?? []
}
let windows = attribute(app, "AXWindows") as? [AXUIElement] ?? []
let expected = "https://claude.ai/epitaxy/" + target
var visited = 0
for (windowIndex, window) in windows.enumerated() {
    var queue: [(AXUIElement, [Int])] = [(window, [])]
    var offset = 0
    while offset < queue.count && visited < 1500 {
        let (element, path) = queue[offset]; offset += 1; visited += 1
        if let url = attribute(element, "AXURL") as? URL, url.absoluteString == expected {
            var scoped: [(AXUIElement, [Int])] = [(element, path)]
            var scopedIndex = 0
            var inputPaths: [[Int]] = []
            var sendPaths: [[Int]] = []
            var idle = false
            var busy = false
            var empty = false
            var enabled = false
            while scopedIndex < scoped.count && scopedIndex < 2500 {
                let (node, nodePath) = scoped[scopedIndex]; scopedIndex += 1
                let role = attribute(node, "AXRole") as? String ?? ""
                if role == "AXTextArea" {
                    let description = attribute(node, "AXDescription") as? String ?? ""
                    if ["提示词", "Prompt"].contains(description) {
                        inputPaths.append(nodePath)
                        let value = attribute(node, "AXValue") as? String ?? "missing"
                        empty = value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        enabled = attribute(node, "AXEnabled") as? Bool ?? false
                    }
                }
                if role == "AXStaticText" {
                    let text = attribute(node, "AXValue") as? String ?? ""
                    if ["Claude 已完成回复", "Claude has finished responding", "Claude is done responding"].contains(text) { idle = true }
                }
                if role == "AXButton" {
                    let title = attribute(node, "AXTitle") as? String ?? ""
                    let label = title.isEmpty ? (attribute(node, "AXDescription") as? String ?? "") : title
                    if ["发送", "Send"].contains(label) && (attribute(node, "AXEnabled") as? Bool ?? false) { sendPaths.append(nodePath) }
                    if ["停止", "Stop", "Stop response"].contains(label) { busy = true }
                }
                if nodePath.count < 64 {
                    for (index, child) in children(node).enumerated() { scoped.append((child, nodePath + [index + 1])) }
                }
            }
            var result: [String: Any] = ["status": "ui_unavailable"]
            if busy { result["status"] = "busy" }
            else if inputPaths.count == 1 && idle && enabled && scopedIndex < 2500 {
                result = ["status": "ready", "window": windowIndex + 1, "page": path, "composer": inputPaths[0], "empty": empty]
                if sendPaths.count == 1 { result["send"] = sendPaths[0] }
            }
            let data = try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
            print(String(data: data, encoding: .utf8)!); exit(0)
        }
        if path.count < 14 {
            for (index, child) in children(element).enumerated() { queue.append((child, path + [index + 1])) }
        }
    }
}
print("{\"status\":\"wrong_window\"}")
