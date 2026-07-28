import SwiftUI

struct ConfigurationView: View {
    @ObservedObject var configuration: ServerConfiguration
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("连接设置")
                    .font(.headline)
                TextField(
                    "https://…/stackchan/",
                    text: $configuration.endpoint
                )
                .textInputAutocapitalization(.never)
                SecureField("Watch 设备密钥", text: $configuration.token)
                Text("密钥只存 Apple Keychain，不进聊天和 Git。")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Button("保存") { dismiss() }
                    .disabled(!configuration.isReady)
            }
        }
    }
}

