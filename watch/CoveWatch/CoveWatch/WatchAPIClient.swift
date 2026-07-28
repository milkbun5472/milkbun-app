import Foundation

struct WatchAPIClient {
    let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func upload(
        recording: RecordingOutput,
        baseURL: URL,
        token: String,
        requestID: String
    ) async throws -> UploadResponse {
        let boundary = "Cove-\(UUID().uuidString)"
        let audio = try Data(contentsOf: recording.url)
        var body = Data()
        body.appendMultipartField(name: "request_id", value: requestID, boundary: boundary)
        body.appendMultipartField(
            name: "duration",
            value: String(format: "%.3f", recording.duration),
            boundary: boundary
        )
        body.appendMultipartFile(
            name: "file",
            filename: "\(requestID).wav",
            mime: "audio/wav",
            data: audio,
            boundary: boundary
        )
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        var request = URLRequest(url: baseURL.appending(path: "watch/voice"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(requestID, forHTTPHeaderField: "Idempotency-Key")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(UploadResponse.self, from: data)
    }

    func turn(
        id: String,
        baseURL: URL,
        token: String
    ) async throws -> TurnResponse {
        var request = URLRequest(url: baseURL.appending(path: "watch/turn/\(id)"))
        request.timeoutInterval = 15
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(TurnResponse.self, from: data)
    }

    func waitForReply(
        turnID: String,
        baseURL: URL,
        token: String,
        attempts: Int = 60
    ) async throws -> TurnResponse {
        for _ in 0..<attempts {
            let result = try await turn(id: turnID, baseURL: baseURL, token: token)
            if result.status == "ready" { return result }
            if result.status == "failed" {
                throw WatchVoiceError.server(result.error ?? "这一轮处理失败")
            }
            try await Task.sleep(for: .seconds(1.25))
        }
        throw WatchVoiceError.replyTimeout
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw WatchVoiceError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw WatchVoiceError.server(message ?? "服务器返回 \(http.statusCode)")
        }
    }
}

private extension Data {
    mutating func appendMultipartField(name: String, value: String, boundary: String) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        append("\(value)\r\n".data(using: .utf8)!)
    }

    mutating func appendMultipartFile(
        name: String,
        filename: String,
        mime: String,
        data: Data,
        boundary: String
    ) {
        append("--\(boundary)\r\n".data(using: .utf8)!)
        append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        append("Content-Type: \(mime)\r\n\r\n".data(using: .utf8)!)
        append(data)
        append("\r\n".data(using: .utf8)!)
    }
}

