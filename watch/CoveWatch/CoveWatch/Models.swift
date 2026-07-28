import Foundation

enum VoicePhase: Equatable {
    case idle
    case requestingPermission
    case recording
    case discarded
    case uploading
    case waitingReply
    case ready
    case playing
    case paused
    case recoverableError(String)

    var status: String {
        switch self {
        case .idle: return "按住说话"
        case .requestingPermission: return "请允许麦克风"
        case .recording: return "正在听你说 · 松开发送"
        case .discarded: return "太短啦，没有发送"
        case .uploading: return "正在发送"
        case .waitingReply: return "言秋正在回你"
        case .ready: return "收到回复"
        case .playing: return "正在播放"
        case .paused: return "已暂停"
        case .recoverableError(let message): return message
        }
    }

    var canRecord: Bool {
        switch self {
        case .idle, .ready, .recoverableError: return true
        default: return false
        }
    }
}

struct UploadResponse: Decodable {
    let ok: Bool
    let queued: Bool
    let turnID: String
    let transcript: String?

    enum CodingKeys: String, CodingKey {
        case ok, queued, transcript
        case turnID = "turn_id"
    }
}

struct TurnResponse: Decodable {
    let ok: Bool
    let status: String
    let transcript: String?
    let replyText: String?
    let audioURL: URL?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case ok, status, transcript, error
        case replyText = "reply_text"
        case audioURL = "audio_url"
    }
}

struct RecordingOutput {
    let url: URL
    let duration: TimeInterval
}

enum WatchVoiceError: LocalizedError {
    case notConfigured
    case microphoneDenied
    case recordingFailed
    case recordingTooShort
    case invalidResponse
    case server(String)
    case replyTimeout

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "先填写服务地址和设备密钥"
        case .microphoneDenied: return "请在设置里允许麦克风"
        case .recordingFailed: return "没有录到声音，再试一次"
        case .recordingTooShort: return "太短啦，没有发送"
        case .invalidResponse: return "后端回复格式不对"
        case .server(let message): return message
        case .replyTimeout: return "回复还在路上，点刷新再看看"
        }
    }
}

