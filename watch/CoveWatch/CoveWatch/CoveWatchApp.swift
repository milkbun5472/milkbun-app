import SwiftUI

@main
struct CoveWatchApp: App {
    @StateObject private var model = ConversationViewModel()

    var body: some Scene {
        WindowGroup {
            ConversationView(model: model)
        }
    }
}

