# Lisa voice prosody shadow

This module borrows the local “cochlea” boundary from
[`hmh323/mubai-ears`](https://github.com/hmh323/mubai-ears) (MIT): preserve
pitch, energy and pause evidence without asking a model to guess directly from
raw audio.

## Current gate

- Stack-chan only.
- Shadow mode: calculate and diagnose, never inject.
- No additional LLM or TTS call.
- Raw WAV stays local and follows the relay's existing delete-after-transcribe
  path.
- The long-lived files contain numeric summaries only:
  `.voice_prosody_baseline.json` and `voice_prosody_shadow.jsonl`.
- A per-device baseline needs eight valid Lisa samples before relative
  observations are emitted.
- The analyzer does not assign emotions. It may eventually say “lighter than
  usual” or “more pauses than usual”; it must not turn those facts into
  “sad/anxious” by itself.

The deployment uses the standard-library implementation in
`tools/voice-prosody/voice_prosody.py`. This intentionally avoids adding
librosa/NumPy/Matplotlib to the always-on relay. The repository's spectrogram
PNG remains useful for manual diagnosis, but is not sent with every chat turn.

## Later adapters

- App already has a device-local relative voice baseline in `js/ears.js`.
  A later v2 can align its field names with this module without retaining
  recordings.
- The Watch Shortcut sends Apple's dictated text, not a waveform, so it cannot
  honestly produce prosody. The native Watch app can reuse this analyzer after
  physical-device installation works and WAV upload is enabled.
