import Combine
import Foundation
import Security

@MainActor
final class ServerConfiguration: ObservableObject {
    @Published var endpoint: String {
        didSet { UserDefaults.standard.set(endpoint, forKey: Self.endpointKey) }
    }
    @Published var token: String {
        didSet { try? Self.saveToken(token) }
    }

    private static let endpointKey = "cove.watch.endpoint"
    private static let tokenAccount = "cove-watch-device-token"
    private static let tokenService = "com.lisa.covewatch"

    init() {
        endpoint = UserDefaults.standard.string(forKey: Self.endpointKey) ?? ""
        token = Self.loadToken() ?? ""
    }

    var baseURL: URL? {
        guard let url = URL(string: endpoint.trimmingCharacters(in: .whitespacesAndNewlines)),
              url.scheme == "https" else { return nil }
        return url
    }

    var isReady: Bool { baseURL != nil && !token.isEmpty }

    private static func saveToken(_ value: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: tokenService,
            kSecAttrAccount as String: tokenAccount
        ]
        SecItemDelete(query as CFDictionary)
        guard !value.isEmpty else { return }
        var insert = query
        insert[kSecValueData as String] = Data(value.utf8)
        let result = SecItemAdd(insert as CFDictionary, nil)
        guard result == errSecSuccess else {
            throw WatchVoiceError.server("无法安全保存设备密钥")
        }
    }

    private static func loadToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: tokenService,
            kSecAttrAccount as String: tokenAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
