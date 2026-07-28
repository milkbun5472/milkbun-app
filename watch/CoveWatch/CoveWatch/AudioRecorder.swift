import AVFoundation
import Foundation

@MainActor
final class AudioRecorder: NSObject {
    private var recorder: AVAudioRecorder?
    private var outputURL: URL?

    func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func start() throws {
        guard recorder == nil else { return }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement)
        try session.setActive(true)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("cove-\(UUID().uuidString).wav")
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false
        ]
        let next = try AVAudioRecorder(url: url, settings: settings)
        guard next.prepareToRecord(), next.record() else {
            try? session.setActive(false)
            throw WatchVoiceError.recordingFailed
        }
        recorder = next
        outputURL = url
    }

    func stop() throws -> RecordingOutput {
        guard let recorder, let outputURL else {
            throw WatchVoiceError.recordingFailed
        }
        let duration = recorder.currentTime
        recorder.stop()
        self.recorder = nil
        self.outputURL = nil
        try? AVAudioSession.sharedInstance().setActive(false)
        return RecordingOutput(url: outputURL, duration: duration)
    }

    func cancel() {
        recorder?.stop()
        if let outputURL { try? FileManager.default.removeItem(at: outputURL) }
        recorder = nil
        outputURL = nil
        try? AVAudioSession.sharedInstance().setActive(false)
    }
}
