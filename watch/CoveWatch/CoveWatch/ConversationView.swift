import SwiftUI

struct ConversationView: View {
    @ObservedObject var model: ConversationViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("言秋")
                            .font(.headline)
                        Text(model.phase.status)
                            .font(.caption2)
                            .foregroundStyle(statusColor)
                    }
                    Spacer()
                    Button {
                        model.showsSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .buttonStyle(.plain)
                }

                if !model.transcript.isEmpty {
                    bubble(model.transcript, mine: true)
                }
                bubble(model.reply, mine: false)

                if model.phase == .waitingReply ||
                    (model.phase.errorMessage != nil && model.latestTurnID != nil) {
                    Button("刷新回复") { model.refresh() }
                        .font(.caption)
                }

                if model.phase == .ready ||
                    model.phase == .playing ||
                    model.phase == .paused {
                    Button {
                        model.togglePlayback()
                    } label: {
                        Label(
                            model.phase == .playing ? "暂停" : "听他说",
                            systemImage: model.phase == .playing ? "pause.fill" : "play.fill"
                        )
                    }
                    .buttonStyle(.bordered)
                }

                holdButton
            }
            .padding(.horizontal, 4)
        }
        .sheet(isPresented: $model.showsSettings) {
            ConfigurationView(configuration: model.configuration)
        }
    }

    private var holdButton: some View {
        Text(model.phase == .recording ? "松开发送" : "按住说话")
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(model.phase == .recording ? Color.red.opacity(0.85) : Color.teal.opacity(0.85))
            .foregroundStyle(.white)
            .clipShape(Capsule())
            .scaleEffect(model.phase == .recording ? 1.04 : 1)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in model.pressBegan() }
                    .onEnded { _ in model.pressEnded() }
            )
            .accessibilityLabel("按住说话，松开发送")
    }

    private var statusColor: Color {
        model.phase.errorMessage == nil ? .secondary : .orange
    }

    private func bubble(_ text: String, mine: Bool) -> some View {
        HStack {
            if mine { Spacer(minLength: 22) }
            Text(text)
                .font(.body)
                .padding(9)
                .background(mine ? Color.pink.opacity(0.35) : Color.blue.opacity(0.28))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            if !mine { Spacer(minLength: 22) }
        }
    }
}

private extension VoicePhase {
    var errorMessage: String? {
        if case .recoverableError(let message) = self { return message }
        return nil
    }
}

