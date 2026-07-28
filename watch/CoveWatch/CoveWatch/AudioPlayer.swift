import AVFoundation
import Foundation

@MainActor
final class AudioPlayer: NSObject, AVAudioPlayerDelegate {
    private var player: AVAudioPlayer?
    var onFinish: (() -> Void)?

    func toggle(url: URL) async throws -> Bool {
        if let player {
            if player.isPlaying {
                player.pause()
                return false
            }
            if player.currentTime > 0, player.currentTime < player.duration {
                player.play()
                return true
            }
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            throw WatchVoiceError.server("这条语音暂时播放不了")
        }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio)
        try session.setActive(true)
        let next = try AVAudioPlayer(data: data)
        next.delegate = self
        next.prepareToPlay()
        guard next.play() else {
            throw WatchVoiceError.server("这条语音暂时播放不了")
        }
        player = next
        return true
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        self.player = nil
        try? AVAudioSession.sharedInstance().setActive(false)
        onFinish?()
    }
}

