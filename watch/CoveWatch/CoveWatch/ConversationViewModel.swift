import Combine
import Foundation
import WatchKit

@MainActor
final class ConversationViewModel: ObservableObject {
    @Published private(set) var phase: VoicePhase = .idle
    @Published private(set) var transcript = ""
    @Published private(set) var reply = "抬腕，按住，说一句。"
    @Published private(set) var latestTurnID: String?
    @Published var showsSettings = false

    let configuration = ServerConfiguration()
    private let recorder = AudioRecorder()
    private let api = WatchAPIClient()
    private let player = AudioPlayer()
    private let minimumDuration: TimeInterval = 0.45
    private var operation: Task<Void, Never>?
    private var isPressing = false

    init() {
        player.onFinish = { [weak self] in self?.phase = .ready }
    }

    func pressBegan() {
        guard phase.canRecord, operation == nil else { return }
        isPressing = true
        operation = Task {
            defer { operation = nil }
            do {
                guard configuration.isReady else {
                    showsSettings = true
                    throw WatchVoiceError.notConfigured
                }
                phase = .requestingPermission
                guard await recorder.requestPermission() else {
                    throw WatchVoiceError.microphoneDenied
                }
                guard isPressing else {
                    phase = .idle
                    return
                }
                try recorder.start()
                phase = .recording
                WKInterfaceDevice.current().play(.start)
            } catch {
                show(error)
            }
        }
    }

    func pressEnded() {
        isPressing = false
        guard phase == .recording else { return }
        do {
            let output = try recorder.stop()
            guard output.duration >= minimumDuration else {
                try? FileManager.default.removeItem(at: output.url)
                phase = .discarded
                WKInterfaceDevice.current().play(.failure)
                settleToIdle()
                return
            }
            operation = Task {
                defer {
                    try? FileManager.default.removeItem(at: output.url)
                    operation = nil
                }
                await send(output)
            }
        } catch {
            show(error)
        }
    }

    func refresh() {
        guard let latestTurnID,
              let baseURL = configuration.baseURL,
              !configuration.token.isEmpty else { return }
        operation?.cancel()
        operation = Task {
            defer { operation = nil }
            do {
                phase = .waitingReply
                let result = try await api.turn(
                    id: latestTurnID,
                    baseURL: baseURL,
                    token: configuration.token
                )
                apply(result)
            } catch {
                show(error)
            }
        }
    }

    func togglePlayback() {
        guard let latestTurnID,
              let baseURL = configuration.baseURL else { return }
        operation = Task {
            defer { operation = nil }
            do {
                let turn = try await api.turn(
                    id: latestTurnID,
                    baseURL: baseURL,
                    token: configuration.token
                )
                guard let audioURL = turn.audioURL else {
                    throw WatchVoiceError.server("这条语音暂时播放不了")
                }
                phase = try await player.toggle(url: audioURL) ? .playing : .paused
            } catch {
                show(error)
            }
        }
    }

    private func send(_ output: RecordingOutput) async {
        do {
            guard let baseURL = configuration.baseURL else {
                throw WatchVoiceError.notConfigured
            }
            let requestID = UUID().uuidString.lowercased()
            phase = .uploading
            let uploaded = try await api.upload(
                recording: output,
                baseURL: baseURL,
                token: configuration.token,
                requestID: requestID
            )
            guard uploaded.ok, uploaded.queued else {
                throw WatchVoiceError.invalidResponse
            }
            latestTurnID = uploaded.turnID
            transcript = uploaded.transcript ?? ""
            phase = .waitingReply
            let result = try await api.waitForReply(
                turnID: uploaded.turnID,
                baseURL: baseURL,
                token: configuration.token
            )
            apply(result)
            WKInterfaceDevice.current().play(.notification)
        } catch {
            show(error)
        }
    }

    private func apply(_ result: TurnResponse) {
        if let transcript = result.transcript { self.transcript = transcript }
        if result.status == "ready" {
            reply = result.replyText ?? "收到啦。"
            phase = .ready
        } else if result.status == "failed" {
            phase = .recoverableError(result.error ?? "这一轮处理失败")
        } else {
            phase = .waitingReply
        }
    }

    private func show(_ error: Error) {
        phase = .recoverableError(
            (error as? LocalizedError)?.errorDescription ?? "暂时连接不上"
        )
        WKInterfaceDevice.current().play(.failure)
    }

    private func settleToIdle() {
        Task {
            try? await Task.sleep(for: .seconds(1.2))
            if phase == .discarded { phase = .idle }
        }
    }
}
