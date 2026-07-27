#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <M5StackChan.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_camera.h>
#include <img_converters.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <freertos/task.h>
#include <time.h>
#include "config.local.h"
#include "motion_library.h"

namespace {
unsigned long lastWifiAttemptAt = 0;
String lastCommandId;
volatile bool clockReady = false;
bool screenWasTouched = false;
unsigned long lastTapAt = 0;
QueueHandle_t eventQueue = nullptr;
QueueHandle_t voiceQueue = nullptr;
QueueHandle_t motionQueue = nullptr;
SemaphoreHandle_t displayMutex = nullptr;
bool faceDrawn = false;
String currentFace = "neutral";
String faceBeforeTap = "neutral";
volatile unsigned long restoreFaceAt = 0;
volatile unsigned long servoTorqueReleaseAt = 0;
volatile bool studyMode = false;
volatile unsigned long studyNextPageAt = 0;
volatile unsigned long studyResumeAt = 0;
bool cameraReady = false;
bool cameraInitAttempted = false;
volatile bool voiceRecording = false;
volatile unsigned long micClosedFeedbackAt = 0;
bool voiceAutoMode = false;
bool voiceContinuation = false;
bool voiceHeardSpeech = false;
uint8_t voiceActiveChunks = 0;
unsigned long voiceStartedAt = 0;
unsigned long voiceSilenceStartedAt = 0;
uint8_t* voiceWav = nullptr;
size_t voiceSamplesRecorded = 0;
bool voiceChunkInFlight = false;
bool topVoiceArmed = true;
bool topWasPressed = false;
unsigned long topReleasedAt = 0;
unsigned long topPressedAt = 0;
static constexpr unsigned long TOP_VOICE_HOLD_MS = 1200;
static constexpr size_t VOICE_CHUNK_SAMPLES = 1600;  // 100 ms at 16 kHz.

struct PendingEvent {
  char json[1024];
};

struct VoiceUpload {
  uint8_t* wav;
  size_t bytes;
  unsigned long durationMs;
  bool continuation;
};

struct MotionRequest {
  char preset[24];
  int yaw;
  int pitch;
  int durationMs;
  uint8_t intensity;
  bool direct;
};

int clampInt(int value, int low, int high) {
  return value < low ? low : (value > high ? high : value);
}

void drawFace(const char* label) {
  if (displayMutex) xSemaphoreTake(displayMutex, portMAX_DELAY);
  auto& display = M5StackChan.Display();
  if (!faceDrawn) {
    display.fillScreen(TFT_BLACK);
    faceDrawn = true;
  }
  display.setTextDatum(middle_center);
  display.setTextColor(TFT_WHITE, TFT_BLACK);
  display.setTextSize(5);
  String eyes = "^  ^";
  String mouth = "  w  ";
  const String mood(label ? label : "neutral");
  if (mood == "happy") { eyes = "^  ^"; mouth = "  v  "; }
  else if (mood == "sad") { eyes = "T  T"; mouth = "  _  "; }
  else if (mood == "angry") { eyes = ">  <"; mouth = "  ~  "; }
  else if (mood == "sleepy") { eyes = "-  -"; mouth = "  o  "; }
  else if (mood == "surprised") { eyes = "O  O"; mouth = "  o  "; }
  else if (mood == "listening") { eyes = "o  o"; mouth = " ... "; }
  else if (mood == "thinking") { eyes = "-  -"; mouth = " ... "; }
  else if (mood == "reading") { eyes = "v  v"; mouth = "  .  "; }
  // The built-in font is fixed-width and every face row has the same number
  // of cells. Opaque text rendering therefore replaces the previous row in
  // one pass; clearing first would create a visible blank-face frame.
  display.startWrite();
  display.drawString(eyes, display.width() / 2, 75);
  display.drawString(mouth, display.width() / 2, 155);
  display.endWrite();
  currentFace = mood;
  if (displayMutex) xSemaphoreGive(displayMutex);
}

void face(const char* label) {
  // A real command or lifecycle state supersedes any pending tap animation.
  restoreFaceAt = 0;
  drawFace(label);
}

void auth(HTTPClient& http);
bool beginHttps(HTTPClient& http, WiFiClientSecure& client,
                const String& url);

void showCameraIndicator() {
  if (displayMutex) xSemaphoreTake(displayMutex, portMAX_DELAY);
  auto& display = M5StackChan.Display();
  display.fillScreen(TFT_RED);
  display.setTextDatum(middle_center);
  display.setTextColor(TFT_WHITE, TFT_RED);
  display.setTextSize(3);
  display.drawString("CAMERA ON", display.width() / 2, display.height() / 2);
  if (displayMutex) xSemaphoreGive(displayMutex);
}

void restoreFaceAfterCamera() {
  String savedFace;
  if (displayMutex) xSemaphoreTake(displayMutex, portMAX_DELAY);
  savedFace = currentFace;
  M5StackChan.Display().fillScreen(TFT_BLACK);
  faceDrawn = false;
  if (displayMutex) xSemaphoreGive(displayMutex);
  drawFace(savedFace.c_str());
}

bool ensureCameraReady() {
  if (cameraReady) return true;
  if (cameraInitAttempted) return false;
  cameraInitAttempted = true;
  // Official CoreS3 GC0308 wiring. Its SCCB bus shares the internal I2C pins;
  // release M5Unified's owner exactly once before esp-camera takes the bus.
  // This must run during setup, before relay/audio tasks can touch that bus.
  M5.In_I2C.release();
  camera_config_t config = {};
  config.pin_pwdn = -1;
  config.pin_reset = -1;
  config.pin_xclk = -1;
  config.pin_sccb_sda = 12;
  config.pin_sccb_scl = 11;
  config.pin_d7 = 47;
  config.pin_d6 = 48;
  config.pin_d5 = 16;
  config.pin_d4 = 15;
  config.pin_d3 = 42;
  config.pin_d2 = 41;
  config.pin_d1 = 40;
  config.pin_d0 = 39;
  config.pin_vsync = 46;
  config.pin_href = 38;
  config.pin_pclk = 45;
  config.xclk_freq_hz = 20000000;
  config.ledc_timer = LEDC_TIMER_0;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.pixel_format = PIXFORMAT_RGB565;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.sccb_i2c_port = -1;
  const esp_err_t error = esp_camera_init(&config);
  cameraReady = error == ESP_OK;
  // GC0308 only needs SCCB while being configured. Give the shared internal
  // bus back to M5Unified so touch/audio/power peripherals keep working.
  M5.In_I2C.begin();
  Serial.printf("[camera] init %s (0x%x)\n",
                cameraReady ? "ok" : "failed", error);
  return cameraReady;
}

bool captureAndUploadPhoto(const String& reason) {
  showCameraIndicator();
  bool ok = ensureCameraReady();
  camera_fb_t* frame = ok ? esp_camera_fb_get() : nullptr;
  uint8_t* jpeg = nullptr;
  size_t jpegBytes = 0;
  if (!frame) {
    ok = false;
  } else {
    ok = frame2jpg(frame, 80, &jpeg, &jpegBytes);
    esp_camera_fb_return(frame);
  }
  if (ok && jpeg && jpegBytes > 0 && jpegBytes <= 400000) {
    WiFiClientSecure client;
    HTTPClient http;
    const String url = String(RELAY_BASE_URL) + "/photo";
    ok = beginHttps(http, client, url);
    if (ok) {
      auth(http);
      http.addHeader("Content-Type", "image/jpeg");
      http.addHeader("X-Capture-Reason", reason);
      const int status = http.POST(jpeg, jpegBytes);
      Serial.printf("[camera] upload HTTP %d, bytes=%u\n", status,
                    static_cast<unsigned>(jpegBytes));
      ok = status == HTTP_CODE_CREATED;
      http.end();
    }
  } else {
    ok = false;
  }
  if (jpeg) free(jpeg);
  restoreFaceAfterCamera();
  return ok;
}

void auth(HTTPClient& http) {
  http.addHeader("Authorization", String("Bearer ") + DEVICE_BEARER_TOKEN);
  http.addHeader("X-Stackchan-Device", DEVICE_ID);
  http.addHeader("Accept", "application/json");
}

bool beginHttps(HTTPClient& http, WiFiClientSecure& client, const String& url) {
  if (strlen(RELAY_ROOT_CA) < 100) {
    Serial.println("[tls] missing production CA; refusing remote request");
    return false;
  }
  client.setCACert(RELAY_ROOT_CA);
  client.setTimeout(12);
  return http.begin(client, url);
}

bool syncClock() {
  if (clockReady) return true;
  configTime(0, 0, "time.cloudflare.com", "pool.ntp.org");
  const unsigned long deadline = millis() + 12000;
  time_t now = time(nullptr);
  while (now < 1704067200 && millis() < deadline) {
    M5StackChan.update();
    delay(100);
    now = time(nullptr);
  }
  clockReady = now >= 1704067200;
  Serial.printf("[clock] %s\n", clockReady ? "synced" : "timeout");
  return clockReady;
}

bool postEvent(const char* eventType, JsonDocument* details = nullptr) {
  if (!eventQueue) return false;
  JsonDocument body;
  body["device_id"] = DEVICE_ID;
  body["event_id"] = String(DEVICE_ID) + "-" + String(millis()) + "-" + String(esp_random(), HEX);
  body["type"] = eventType;
  body["device_ms"] = millis();
  body["wifi_rssi"] = WiFi.RSSI();
  if (details) body["payload"] = details->as<JsonVariant>();
  String json;
  serializeJson(body, json);
  if (json.length() >= sizeof(PendingEvent::json)) return false;
  PendingEvent pending = {};
  memcpy(pending.json, json.c_str(), json.length() + 1);
  return xQueueSendToBack(eventQueue, &pending, 0) == pdTRUE;
}

bool sendEventNow(const char* json) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client;
  HTTPClient http;
  if (!beginHttps(http, client, String(RELAY_BASE_URL) + "/event")) return false;
  auth(http);
  http.addHeader("Content-Type", "application/json");
  const int status = http.POST(json);
  http.end();
  return status >= 200 && status < 300;
}

uint16_t readLe16(const uint8_t* data) {
  return static_cast<uint16_t>(data[0])
       | (static_cast<uint16_t>(data[1]) << 8);
}

uint32_t readLe32(const uint8_t* data) {
  return static_cast<uint32_t>(data[0])
       | (static_cast<uint32_t>(data[1]) << 8)
       | (static_cast<uint32_t>(data[2]) << 16)
       | (static_cast<uint32_t>(data[3]) << 24);
}

void writeLe16(uint8_t* data, uint16_t value) {
  data[0] = value & 0xff;
  data[1] = (value >> 8) & 0xff;
}

void writeLe32(uint8_t* data, uint32_t value) {
  data[0] = value & 0xff;
  data[1] = (value >> 8) & 0xff;
  data[2] = (value >> 16) & 0xff;
  data[3] = (value >> 24) & 0xff;
}

void writePcmWavHeader(uint8_t* wav, uint32_t pcmBytes) {
  memcpy(wav, "RIFF", 4);
  writeLe32(wav + 4, 36 + pcmBytes);
  memcpy(wav + 8, "WAVEfmt ", 8);
  writeLe32(wav + 16, 16);
  writeLe16(wav + 20, 1);
  writeLe16(wav + 22, 1);
  writeLe32(wav + 24, 16000);
  writeLe32(wav + 28, 16000 * 2);
  writeLe16(wav + 32, 2);
  writeLe16(wav + 34, 16);
  memcpy(wav + 36, "data", 4);
  writeLe32(wav + 40, pcmBytes);
}

bool uploadVoiceNow(const VoiceUpload& voice) {
  if (!voice.wav || voice.bytes < 44 || WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client;
  HTTPClient http;
  if (!beginHttps(http, client, String(RELAY_BASE_URL) + "/voice")) return false;
  auth(http);
  http.addHeader("Content-Type", "audio/wav");
  http.addHeader("X-Stackchan-Voice-Continuation",
                 voice.continuation ? "1" : "0");
  const int status = http.POST(voice.wav, voice.bytes);
  http.end();
  Serial.printf("[voice] upload HTTP %d, bytes=%u\n", status,
                static_cast<unsigned>(voice.bytes));
  return status == HTTP_CODE_ACCEPTED;
}

bool queueVoiceChunk() {
  if (!voiceWav || voiceChunkInFlight) return false;
  const size_t maxSamples = (VOICE_MAX_RECORD_MS * 16000UL) / 1000UL;
  if (voiceSamplesRecorded + VOICE_CHUNK_SAMPLES > maxSamples) return false;
  auto* target = reinterpret_cast<int16_t*>(
      voiceWav + 44 + voiceSamplesRecorded * sizeof(int16_t));
  if (!M5.Mic.record(target, VOICE_CHUNK_SAMPLES, 16000, false)) return false;
  const unsigned long deadline = millis() + 100;
  while (!M5.Mic.isRecording() &&
         static_cast<int32_t>(millis() - deadline) < 0) {
    delay(1);
  }
  voiceChunkInFlight = M5.Mic.isRecording();
  return voiceChunkInFlight;
}

uint32_t voiceChunkMeanAbs(size_t sampleOffset, size_t sampleCount) {
  if (!voiceWav || !sampleCount) return 0;
  const auto* samples = reinterpret_cast<const int16_t*>(
      voiceWav + 44 + sampleOffset * sizeof(int16_t));
  uint64_t sum = 0;
  for (size_t i = 0; i < sampleCount; ++i) {
    const int32_t value = samples[i];
    sum += static_cast<uint32_t>(value < 0 ? -value : value);
  }
  return static_cast<uint32_t>(sum / sampleCount);
}

bool startVoiceRecording(bool autoMode = false, bool continuation = false) {
  if (voiceRecording || voiceWav || !voiceQueue ||
      uxQueueMessagesWaiting(voiceQueue) > 0) return false;
  const size_t maxSamples = (VOICE_MAX_RECORD_MS * 16000UL) / 1000UL;
  const size_t capacity = 44 + maxSamples * sizeof(int16_t);
  voiceWav = static_cast<uint8_t*>(ps_malloc(capacity));
  if (!voiceWav) {
    Serial.println("[voice] PSRAM allocation failed");
    face("sad");
    return false;
  }
  memset(voiceWav, 0, capacity);
  M5.Speaker.end();
  voiceSamplesRecorded = 0;
  voiceChunkInFlight = false;
  voiceAutoMode = autoMode;
  voiceContinuation = continuation;
  voiceHeardSpeech = false;
  voiceActiveChunks = 0;
  voiceSilenceStartedAt = 0;
  if (!queueVoiceChunk()) {
    M5.Mic.end();
    free(voiceWav);
    voiceWav = nullptr;
    Serial.println("[voice] microphone start failed");
    face("sad");
    return false;
  }
  voiceStartedAt = millis();
  voiceRecording = true;
  face("listening");
  Serial.printf("[voice] recording started mode=%s\n",
                voiceAutoMode ? "auto" : "hold");
  return true;
}

void restoreSpeakerAfterRecording() {
  // CoreS3's mic and speaker share the codec. Fully release the input task and
  // restore one idle output task. Playback must reuse it instead of calling
  // begin() twice, which can deadlock the codec.
  M5.Mic.end();
  delay(20);
  if (!M5.Speaker.isRunning() && !M5.Speaker.begin()) {
    Serial.println("[voice] speaker restore failed");
  }
}

void cancelVoiceRecording(const char* reason) {
  if (voiceChunkInFlight) M5.Mic.end();
  voiceChunkInFlight = false;
  voiceRecording = false;
  voiceAutoMode = false;
  voiceContinuation = false;
  voiceHeardSpeech = false;
  voiceActiveChunks = 0;
  voiceSilenceStartedAt = 0;
  if (voiceWav) free(voiceWav);
  voiceWav = nullptr;
  restoreSpeakerAfterRecording();
  // Hands-free listening closes itself when nobody speaks. Give Lisa an
  // explicit visual "closed" beat before returning to the normal happy face.
  if (reason && !strcmp(reason, "no speech")) {
    face("sleepy");
    micClosedFeedbackAt = millis() + 900;
  } else {
    face("happy");
  }
  Serial.printf("[voice] cancelled: %s\n", reason ? reason : "unknown");
}

void finishVoiceRecording() {
  if (!voiceRecording || !voiceWav) return;
  const bool heardSpeech = voiceHeardSpeech;
  if (voiceChunkInFlight) {
    M5.Mic.end();  // At most the current 100 ms chunk remains.
    voiceSamplesRecorded += VOICE_CHUNK_SAMPLES;
    voiceChunkInFlight = false;
  } else {
    M5.Mic.end();
  }
  voiceRecording = false;
  const bool continuation = voiceContinuation;
  voiceAutoMode = false;
  voiceContinuation = false;
  voiceHeardSpeech = false;
  voiceActiveChunks = 0;
  voiceSilenceStartedAt = 0;
  const unsigned long durationMs =
      (voiceSamplesRecorded * 1000UL) / 16000UL;
  if (durationMs < 350) {
    free(voiceWav);
    voiceWav = nullptr;
    face("sad");
    Serial.println("[voice] recording too short");
    return;
  }
  const size_t pcmBytes = voiceSamplesRecorded * sizeof(int16_t);
  writePcmWavHeader(voiceWav, pcmBytes);
  VoiceUpload pending = {
    voiceWav, 44 + pcmBytes, durationMs, continuation
  };
  voiceWav = nullptr;
  if (xQueueSendToBack(voiceQueue, &pending, 0) != pdTRUE) {
    free(pending.wav);
    restoreSpeakerAfterRecording();
    face("sad");
    Serial.println("[voice] upload queue full");
    return;
  }
  restoreSpeakerAfterRecording();
  if (heardSpeech && motionQueue) {
    // Acknowledge Lisa only after the microphone has closed. Moving the
    // feedback servos during capture would put motor noise into her recording
    // and could keep the silence detector open. The existing nod choreography
    // contains two small nods; reduced intensity keeps it conversational.
    MotionRequest acknowledgement = {};
    strncpy(acknowledgement.preset, "nod",
            sizeof(acknowledgement.preset) - 1);
    acknowledgement.intensity = 45;
    acknowledgement.direct = false;
    xQueueSendToFront(motionQueue, &acknowledgement, 0);
  }
  face("thinking");
  Serial.printf("[voice] queued %lu ms\n", durationMs);
}

bool playPcmWav(const uint8_t* wav, size_t wavBytes) {
  if (!wav || wavBytes < 12 || memcmp(wav, "RIFF", 4) || memcmp(wav + 8, "WAVE", 4)) {
    Serial.println("[audio] invalid RIFF/WAVE header");
    return false;
  }

  uint16_t audioFormat = 0;
  uint16_t channels = 0;
  uint16_t bitsPerSample = 0;
  uint32_t sampleRate = 0;
  const uint8_t* pcm = nullptr;
  size_t pcmBytes = 0;
  size_t offset = 12;
  while (offset + 8 <= wavBytes) {
    const uint8_t* chunk = wav + offset;
    const uint32_t chunkBytes = readLe32(chunk + 4);
    const size_t dataOffset = offset + 8;
    if (dataOffset > wavBytes || chunkBytes > wavBytes - dataOffset) {
      Serial.println("[audio] truncated WAV chunk");
      return false;
    }
    if (!memcmp(chunk, "fmt ", 4) && chunkBytes >= 16) {
      audioFormat = readLe16(wav + dataOffset);
      channels = readLe16(wav + dataOffset + 2);
      sampleRate = readLe32(wav + dataOffset + 4);
      bitsPerSample = readLe16(wav + dataOffset + 14);
    } else if (!memcmp(chunk, "data", 4)) {
      pcm = wav + dataOffset;
      pcmBytes = chunkBytes;
    }
    // RIFF chunks are word-aligned; macOS say currently inserts a large JUNK
    // chunk before the PCM data, so padding must be honored.
    offset = dataOffset + chunkBytes + (chunkBytes & 1U);
  }

  if (audioFormat != 1 || channels != 1 || bitsPerSample != 16
      || sampleRate == 0 || !pcm || pcmBytes < 2 || (pcmBytes & 1U)) {
    Serial.printf("[audio] unsupported WAV fmt=%u ch=%u bits=%u rate=%lu bytes=%u\n",
                  audioFormat, channels, bitsPerSample,
                  static_cast<unsigned long>(sampleRate),
                  static_cast<unsigned>(pcmBytes));
    return false;
  }

  const bool queued = M5.Speaker.playRaw(
      reinterpret_cast<const int16_t*>(pcm), pcmBytes / sizeof(int16_t),
      sampleRate, false, 1, -1, true);
  if (!queued) {
    Serial.println("[audio] speaker queue rejected PCM");
    return false;
  }

  // Playback is asynchronous. Give the speaker task time to claim the buffer
  // before checking isPlaying(), otherwise the PSRAM backing it can be freed
  // before the first sample is consumed.
  const unsigned long startDeadline = millis() + 500;
  while (!M5.Speaker.isPlaying() && millis() < startDeadline) {
    delay(5);
  }
  if (!M5.Speaker.isPlaying()) {
    Serial.println("[audio] speaker never started");
    return false;
  }
  // M5Unified briefly clears isPlaying() while its internal DMA buffers swap.
  // Releasing this runtime WAV at that instant produces only the first
  // syllable. Keep the PSRAM buffer alive for the duration encoded by the WAV.
  const unsigned long expectedMs =
      (static_cast<uint64_t>(pcmBytes) * 1000ULL) /
      (static_cast<uint64_t>(sampleRate) * sizeof(int16_t));
  const unsigned long playbackStartedAt = millis();
  while (millis() - playbackStartedAt < expectedMs + 150) {
    delay(5);
  }
  const unsigned long drainDeadline = millis() + 1000;
  while (M5.Speaker.isPlaying() && millis() < drainDeadline) delay(5);
  return true;
}

bool playWavUrl(const String& url, int volume) {
  if (!url.startsWith("https://")) return false;
  // Fully release the input path before bringing the codec's output path up.
  // A Speaker task may still be "running" after a mic turn while the physical
  // codec remains routed to input. Reusing that task reports successful silent
  // playback. End it first, then perform exactly one clean output begin.
  M5.Mic.end();
  M5.Speaker.end();
  delay(20);
  if (!M5.Speaker.begin()) return false;
  WiFiClientSecure client;
  HTTPClient http;
  if (!beginHttps(http, client, url)) return false;
  auth(http);
  const int status = http.GET();
  if (status != HTTP_CODE_OK) { http.end(); return false; }
  const int announced = http.getSize();
  if (announced <= 0 || static_cast<size_t>(announced) > MAX_AUDIO_BYTES) {
    http.end();
    return false;
  }
  uint8_t* wav = static_cast<uint8_t*>(ps_malloc(announced));
  if (!wav) { http.end(); return false; }
  WiFiClient* stream = http.getStreamPtr();
  size_t got = 0;
  const unsigned long deadline = millis() + 20000;
  while (got < static_cast<size_t>(announced) && millis() < deadline) {
    const size_t available = stream->available();
    if (available) {
      got += stream->readBytes(wav + got, min(available, static_cast<size_t>(announced) - got));
    } else {
      delay(2);
    }
  }
  http.end();
  if (got != static_cast<size_t>(announced)) { free(wav); return false; }
  M5.Speaker.setVolume(clampInt(volume, 0, 255));
  const bool ok = playPcmWav(wav, got);
  free(wav);
  return ok;
}

void reportTap(const char* source) {
  // The screen and the three-zone sensor can occasionally overlap in the same
  // update cycle. Treat that as one human gesture instead of two messages.
  if (millis() - lastTapAt < 500) return;
  lastTapAt = millis();
  const bool wasStudying = studyMode;
  if (wasStudying) {
    studyMode = false;
    studyNextPageAt = 0;
    studyResumeAt = millis() + 3200;
    MotionRequest request = {};
    strncpy(request.preset, "study_lookup", sizeof(request.preset) - 1);
    request.intensity = 75;
    request.direct = false;
    if (motionQueue) xQueueSendToFront(motionQueue, &request, 0);
    restoreFaceAt = 0;
    face("happy");
  } else if (!restoreFaceAt) {
    if (displayMutex) xSemaphoreTake(displayMutex, portMAX_DELAY);
    faceBeforeTap = currentFace;
    if (displayMutex) xSemaphoreGive(displayMutex);
  }
  if (!wasStudying) {
    restoreFaceAt = millis() + 1200;
    drawFace("surprised");
  }
  JsonDocument detail;
  detail["source"] = source;
  postEvent("tap", &detail);
}

void moveTo(int yaw, int pitch, int durationMs) {
  if (!SERVOS_ENABLED) return;
  yaw = clampInt(yaw, SERVO_YAW_MIN, SERVO_YAW_MAX);
  pitch = clampInt(pitch, SERVO_PITCH_MIN, SERVO_PITCH_MAX);
  // Relay uses conventional centered degrees. The official StackChan BSP uses
  // calibrated, home-relative 0.1-degree units on both axes, so 90/90 must map
  // to 0/0. Keep the relay-side limits deliberately narrower than the BSP's
  // mechanical limits.
  const int stackYaw = clampInt((yaw - 90) * 10, -1280, 1280);
  const int stackPitch = clampInt((pitch - 90) * 10, 0, 900);
  durationMs = clampInt(durationMs, 100, 3000);
  const int speed = clampInt(250000 / durationMs, 100, 1000);
  M5StackChan.Motion.setTorqueEnabled(true);
  M5StackChan.Motion.move(stackYaw, stackPitch, speed);
  servoTorqueReleaseAt = millis() + durationMs + 500;
}

void playFrames(const MotionFrame* frames, size_t frameCount,
                uint8_t intensity) {
  const int scale = clampInt(intensity, 25, 100);
  for (size_t index = 0; index < frameCount; ++index) {
    const auto& frame = frames[index];
    const int yaw = 90 + frame.yawOffset * scale / 100;
    const int pitch = 90 + frame.pitchOffset * scale / 100;
    moveTo(yaw, pitch, frame.durationMs);
    vTaskDelay(pdMS_TO_TICKS(frame.durationMs + 40));
  }
}

bool isMotionPreset(const String& preset) {
  return MotionLibrary::find(preset.c_str()) != nullptr;
}

void playMotionPreset(const char* rawPreset, uint8_t intensity) {
  const MotionSequence* sequence = MotionLibrary::find(rawPreset);
  if (!sequence) return;
  if (sequence->mode == MotionMode::EnterStudy) {
    studyMode = true;
    studyNextPageAt = millis() + 12000;
    face("reading");
  } else if (sequence->mode == MotionMode::ExitStudy) {
    studyMode = false;
    studyNextPageAt = 0;
    // A human pat schedules a short look-up in reportTap(). An explicit
    // study_lookup command has no resume timer and ends study for real.
  } else if (sequence->mode == MotionMode::StudyPage && !studyMode) {
    return;
  } else if (sequence->mode == MotionMode::OneShot && studyMode) {
    // An explicit action supersedes passive reading.
    studyMode = false;
    studyNextPageAt = 0;
  }
  playFrames(sequence->frames, sequence->frameCount, intensity);
  if (sequence->mode == MotionMode::StudyPage && studyMode) {
    face("reading");
  }
}

void motionTask(void*) {
  MotionRequest request = {};
  for (;;) {
    if (motionQueue &&
        xQueueReceive(motionQueue, &request, portMAX_DELAY) == pdTRUE) {
      if (request.direct) {
        studyMode = false;
        studyNextPageAt = 0;
        studyResumeAt = 0;
        moveTo(request.yaw, request.pitch, request.durationMs);
      } else {
        playMotionPreset(request.preset, request.intensity);
      }
    }
  }
}

bool queueMotion(JsonObject payload) {
  if (!SERVOS_ENABLED || !motionQueue) return false;
  MotionRequest request = {};
  const String preset = payload["preset"] | "";
  if (preset.length()) {
    if (!isMotionPreset(preset)) return false;
    // Network commands are intentional mode changes. Only the locally
    // scheduled page-turn may preserve a pending return-to-reading timer.
    if (preset != "study_page") studyResumeAt = 0;
    strncpy(request.preset, preset.c_str(), sizeof(request.preset) - 1);
    request.intensity = clampInt(payload["intensity"] | 75, 25, 100);
    request.direct = false;
  } else {
    request.yaw = payload["yaw"] | 90;
    request.pitch = payload["pitch"] | 90;
    request.durationMs = payload["duration_ms"] | 500;
    request.direct = true;
  }
  return xQueueSendToBack(motionQueue, &request, 0) == pdTRUE;
}

bool queuePreset(const char* preset, uint8_t intensity, bool front = false) {
  if (!SERVOS_ENABLED || !motionQueue || !MotionLibrary::find(preset)) {
    return false;
  }
  studyResumeAt = 0;
  MotionRequest request = {};
  strncpy(request.preset, preset, sizeof(request.preset) - 1);
  request.intensity = clampInt(intensity, 25, 100);
  request.direct = false;
  return (front ? xQueueSendToFront(motionQueue, &request, 0)
                : xQueueSendToBack(motionQueue, &request, 0)) == pdTRUE;
}

void applyMoodCue(const String& mood) {
  // One speak command owns the whole cue. Face changes immediately while the
  // motion task begins its choreography in parallel with WAV playback.
  if (mood == "happy") {
    face("happy");
    queuePreset("happy_bounce", 60, true);
  } else if (mood == "thinking") {
    face("thinking");
    queuePreset("thinking_tilt", 55, true);
  } else if (mood == "soft") {
    face("happy");
    queuePreset("soft_sway", 45, true);
  } else if (mood == "wilt") {
    face("sad");
    queuePreset("wilt", 50, true);
  }
}

bool executeCommand(JsonObject command) {
  const String type = command["type"] | "";
  JsonObject payload = command["payload"].as<JsonObject>();
  if (type == "emote") {
    const String name = payload["name"] | "neutral";
    face(name.c_str());
    return true;
  }
  if (type == "move") {
    return queueMotion(payload);
  }
  if (type == "speak") {
    const String audioUrl = payload["audio_url"] | "";
    const String mood = payload["mood"] | "";
    if (mood.length()) applyMoodCue(mood);
    const bool ok = playWavUrl(audioUrl, payload["volume"] | 150);
    if (ok && (payload["listen_after"] | false)) {
      // Playback is fully stopped when playWavUrl returns, but the enclosure
      // and room keep a short acoustic tail. CoreS3 also needs breathing room
      // when switching the shared audio hardware from speaker back to mic.
      // Show the listening face only after that gap so Lisa knows exactly when
      // her next turn begins.
      delay(1200);
      startVoiceRecording(true, true);
    }
    return ok;
  }
  if (type == "camera") {
    const String action = payload["action"] | "";
    const String requestedBy = payload["requested_by"] | "";
    const String reason = payload["reason"] | "";
    if (action != "capture" || requestedBy != "lisa" ||
        reason.isEmpty() || reason.indexOf('\r') >= 0 ||
        reason.indexOf('\n') >= 0) {
      return false;
    }
    return captureAndUploadPhoto(reason);
  }
  return false;
}

void executePendingCommand(const char* raw);

void pollOnceInBackground() {
  WiFiClientSecure client;
  HTTPClient http;
  String url = String(RELAY_BASE_URL) + "/poll?device_id=" + DEVICE_ID;
  if (!beginHttps(http, client, url)) return;
  auth(http);
  const int status = http.GET();
  if (status == HTTP_CODE_NO_CONTENT) { http.end(); return; }
  if (status != HTTP_CODE_OK) {
    Serial.printf("[poll] HTTP %d\n", status);
    http.end();
    return;
  }
  const String raw = http.getString();
  http.end();
  if (raw.length() >= 2048) {
    Serial.printf("[poll] command too large: %u\n", static_cast<unsigned>(raw.length()));
    return;
  }
  executePendingCommand(raw.c_str());
}

void pollTask(void*) {
  for (;;) {
    if (WiFi.status() == WL_CONNECTED && clockReady) {
      VoiceUpload voice = {};
      if (!voiceRecording && voiceQueue &&
          xQueueReceive(voiceQueue, &voice, 0) == pdTRUE) {
        const bool ok = uploadVoiceNow(voice);
        if (ok) {
          free(voice.wav);
          JsonDocument detail;
          detail["ok"] = true;
          detail["duration_ms"] = voice.durationMs;
          postEvent("voice_upload_result", &detail);
          face("happy");
        } else {
          // Keep the only copy in PSRAM and retry; never discard Lisa's words
          // merely because Wi-Fi or the relay had a transient failure.
          xQueueSendToFront(voiceQueue, &voice, 0);
          face("sad");
        }
      }
      PendingEvent pending = {};
      while (eventQueue && xQueueReceive(eventQueue, &pending, 0) == pdTRUE) {
        if (!sendEventNow(pending.json)) {
          // Preserve the event and retry after the current network hiccup.
          xQueueSendToFront(eventQueue, &pending, 0);
          break;
        }
      }
      // Do not pull a speak command while the microphone owns the conversation.
      if (!voiceRecording) pollOnceInBackground();
    }
    vTaskDelay(pdMS_TO_TICKS(POLL_INTERVAL_MS));
  }
}

void executePendingCommand(const char* raw) {
  JsonDocument doc;
  if (deserializeJson(doc, raw)) return;
  const String id = doc["id"] | "";
  if (!id.length() || id == lastCommandId) return;
  const uint64_t expiresAt = doc["expires_at_ms"] | 0ULL;
  const uint64_t serverNow = doc["server_now_ms"] | 0ULL;
  if (expiresAt && serverNow && serverNow > expiresAt) return;
  lastCommandId = id;  // at-most-once on this boot, even if execution fails
  const bool ok = executeCommand(doc.as<JsonObject>());
  JsonDocument detail;
  detail["command_id"] = id;
  detail["command_type"] = doc["type"] | "";
  detail["ok"] = ok;
  postEvent("command_result", &detail);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!clockReady && syncClock()) {
      face("happy");
      postEvent("online");
    }
    return;
  }
  // A zero timestamp means "never attempted". Do not make a fresh boot sit in
  // the sleepy face for an entire retry interval before its first Wi-Fi try.
  if (lastWifiAttemptAt && millis() - lastWifiAttemptAt < WIFI_RETRY_MS) return;
  lastWifiAttemptAt = millis();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  for (const auto& network : WIFI_NETWORKS) {
    Serial.printf("[wifi] trying %s\n", network.ssid);
    WiFi.begin(network.ssid, network.password);
    const unsigned long until = millis() + 8000;
    while (WiFi.status() != WL_CONNECTED && millis() < until) {
      M5.update();
      delay(100);
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[wifi] connected %s, %s\n", network.ssid, WiFi.localIP().toString().c_str());
      face("neutral");
      if (syncClock()) {
        face("happy");
        postEvent("online");
      } else {
        face("sad");
      }
      return;
    }
    WiFi.disconnect(true);
  }
}
}  // namespace

void setup() {
  Serial.begin(115200);
  M5StackChan.begin();
  Serial.begin(115200);
  Serial.printf("[touch] display=%s\n", M5StackChan.Display().touch() ? "enabled" : "disabled");
  M5StackChan.Display().setRotation(1);
  displayMutex = xSemaphoreCreateMutex();
  eventQueue = xQueueCreate(8, sizeof(PendingEvent));
  voiceQueue = xQueueCreate(1, sizeof(VoiceUpload));
  motionQueue = xQueueCreate(4, sizeof(MotionRequest));
  face("sleepy");
  // Initialize the camera before either background task starts. Lazy init from
  // a relay command races M5Unified's internal-I2C users on CoreS3.
  ensureCameraReady();
  M5StackChan.setServoPowerEnabled(SERVOS_ENABLED);
  if (SERVOS_ENABLED) {
    // Start from the feedback servos' measured position. Do not snap to home
    // at boot; the first explicit command will move gently from the real pose.
    // Feedback reads from these two serial servos are comparatively slow and
    // can starve the relay task after a move. The BSP already sampled their
    // actual position during initialization, so animate from that snapshot and
    // release torque on our own timer without continuously polling feedback.
    M5StackChan.Motion.setAutoAngleSyncEnabled(false);
    M5StackChan.Motion.setAutoTorqueReleaseEnabled(false);
  }
  if (eventQueue) {
    xTaskCreatePinnedToCore(pollTask, "relay-poll", 8192, nullptr, 1, nullptr, 0);
  }
  if (motionQueue) {
    xTaskCreatePinnedToCore(motionTask, "motion-player", 4096, nullptr, 1, nullptr, 1);
  }
  connectWifi();
}

void loop() {
  M5StackChan.update();
  connectWifi();

  if (micClosedFeedbackAt &&
      static_cast<int32_t>(millis() - micClosedFeedbackAt) >= 0) {
    micClosedFeedbackAt = 0;
    face("happy");
  }

  if (restoreFaceAt && static_cast<int32_t>(millis() - restoreFaceAt) >= 0) {
    restoreFaceAt = 0;
    drawFace(faceBeforeTap.c_str());
  }

  if (!studyMode && studyResumeAt &&
      static_cast<int32_t>(millis() - studyResumeAt) >= 0) {
    MotionRequest request = {};
    strncpy(request.preset, "study_read", sizeof(request.preset) - 1);
    request.intensity = 75;
    request.direct = false;
    if (motionQueue &&
        xQueueSendToFront(motionQueue, &request, 0) == pdTRUE) {
      studyResumeAt = 0;
    } else {
      studyResumeAt = millis() + 500;
    }
  }

  if (studyMode && studyNextPageAt &&
      static_cast<int32_t>(millis() - studyNextPageAt) >= 0) {
    MotionRequest request = {};
    strncpy(request.preset, "study_page", sizeof(request.preset) - 1);
    request.intensity = 65;
    request.direct = false;
    if (motionQueue &&
        xQueueSendToBack(motionQueue, &request, 0) == pdTRUE) {
      // A small deterministic range avoids a robotic metronome without
      // introducing another random state source.
      studyNextPageAt = millis() + 14000 + (millis() % 9000);
    } else {
      studyNextPageAt = millis() + 1500;
    }
  }

  if (servoTorqueReleaseAt &&
      static_cast<int32_t>(millis() - servoTorqueReleaseAt) >= 0) {
    servoTorqueReleaseAt = 0;
    M5StackChan.Motion.setTorqueEnabled(false);
  }

  // Read through M5Unified's event layer. Direct display.getTouch() stays at
  // zero with some CoreS3 + StackChan-BSP combinations even though the GT911
  // controller is active.
  const bool screenTouched = M5.Touch.getCount() > 0;
  if (screenTouched && !screenWasTouched) {
    const auto& touch = M5.Touch.getDetail(0);
    Serial.printf("[touch] screen x=%d y=%d\n", touch.x, touch.y);
    if (voiceRecording) {
      // Front screen is the always-available physical mute button.
      cancelVoiceRecording("screen mute");
    } else {
      reportTap("screen");
    }
  }
  screenWasTouched = screenTouched;

  auto& top = M5StackChan.TouchSensor;
  const unsigned long now = millis();
  const bool topPressed = top.isPressed();
  if (!topPressed) {
    if (topWasPressed && topPressedAt && studyMode && !voiceRecording &&
        now - topPressedAt >= 80 &&
        now - topPressedAt < TOP_VOICE_HOLD_MS) {
      // While reading, a light pat is the natural "look up" gesture. Long
      // holds remain reserved for opening the microphone.
      reportTap("head");
    }
    topPressedAt = 0;
    if (!topReleasedAt) topReleasedAt = now;
    // A completed release, not the noisy trailing edge of the previous touch,
    // is what arms the next physical voice turn.
    if (now - topReleasedAt >= 700) topVoiceArmed = true;
  } else {
    topReleasedAt = 0;
    if (!topPressedAt) topPressedAt = now;
  }
  topWasPressed = topPressed;
  if (topVoiceArmed && topPressed && topPressedAt &&
      now - topPressedAt >= TOP_VOICE_HOLD_MS && !voiceRecording) {
    // The head sensor is capacitive and can acquire short phantom presses from
    // nearby movement/USB noise. A deliberate hold is the closed→listening
    // gate; ambient sound alone can no longer open the microphone.
    if (startVoiceRecording(true, false)) topVoiceArmed = false;
  }
  if (voiceRecording && voiceChunkInFlight && !M5.Mic.isRecording()) {
    const uint32_t meanAbs =
        voiceChunkMeanAbs(voiceSamplesRecorded, VOICE_CHUNK_SAMPLES);
    voiceSamplesRecorded += VOICE_CHUNK_SAMPLES;
    voiceChunkInFlight = false;
    const size_t maxSamples = (VOICE_MAX_RECORD_MS * 16000UL) / 1000UL;
    if (voiceSamplesRecorded >= maxSamples) {
      finishVoiceRecording();
    } else if (voiceAutoMode) {
      const unsigned long now = millis();
      if (meanAbs >= VOICE_ACTIVITY_THRESHOLD) {
        if (voiceHeardSpeech) {
          // Once speech has been established, one active chunk is enough to
          // prove Lisa resumed after a natural pause. The old two-chunk gate
          // let the existing silence timer keep running into resumed speech.
          voiceActiveChunks = 2;
          voiceSilenceStartedAt = 0;
        } else {
          if (voiceActiveChunks < 255) ++voiceActiveChunks;
        }
        if (!voiceHeardSpeech && voiceActiveChunks >= 2) {
          voiceHeardSpeech = true;
          voiceSilenceStartedAt = 0;
        }
      } else if (voiceHeardSpeech) {
        voiceActiveChunks = 0;
        if (!voiceSilenceStartedAt) voiceSilenceStartedAt = now;
        if (now - voiceSilenceStartedAt >= VOICE_AUTO_SILENCE_MS) {
          finishVoiceRecording();
        }
      } else {
        voiceActiveChunks = 0;
        if (now - voiceStartedAt >= VOICE_AUTO_WAIT_MS) {
          cancelVoiceRecording("no speech");
        }
      }
      if (voiceRecording && !queueVoiceChunk()) {
        finishVoiceRecording();
      }
    }
  }

  delay(10);
}
