#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <M5StackChan.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <freertos/task.h>
#include <time.h>
#include "config.local.h"

namespace {
unsigned long lastWifiAttemptAt = 0;
String lastCommandId;
volatile bool clockReady = false;
bool screenWasTouched = false;
unsigned long lastTapAt = 0;
QueueHandle_t eventQueue = nullptr;
SemaphoreHandle_t displayMutex = nullptr;
bool faceDrawn = false;
String currentFace = "neutral";
String faceBeforeTap = "neutral";
volatile unsigned long restoreFaceAt = 0;

struct PendingEvent {
  char json[1024];
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
  while (M5.Speaker.isPlaying()) {
    delay(5);
  }
  return true;
}

bool playWavUrl(const String& url, int volume) {
  if (!url.startsWith("https://")) return false;
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
  if (!restoreFaceAt) {
    if (displayMutex) xSemaphoreTake(displayMutex, portMAX_DELAY);
    faceBeforeTap = currentFace;
    if (displayMutex) xSemaphoreGive(displayMutex);
  }
  restoreFaceAt = millis() + 1200;
  drawFace("surprised");
  JsonDocument detail;
  detail["source"] = source;
  postEvent("tap", &detail);
}

void moveTo(int yaw, int pitch, int durationMs) {
  if (!SERVOS_ENABLED) return;
  yaw = clampInt(yaw, SERVO_YAW_MIN, SERVO_YAW_MAX);
  pitch = clampInt(pitch, SERVO_PITCH_MIN, SERVO_PITCH_MAX);
  // Relay uses conventional centered degrees. The official StackChan BSP uses
  // 0.1-degree units: X is centered at 0, while Y's safe physical range is
  // 5..85 degrees. Thus relay pitch 90 maps to the physical 45-degree center.
  const int stackYaw = clampInt((yaw - 90) * 10, -1280, 1280);
  const int stackPitch = clampInt((pitch - 45) * 10, 50, 850);
  durationMs = clampInt(durationMs, 100, 3000);
  const int speed = clampInt(250000 / durationMs, 100, 1000);
  M5StackChan.Motion.move(stackYaw, stackPitch, speed);
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
    moveTo(payload["yaw"] | 90, payload["pitch"] | 90, payload["duration_ms"] | 500);
    return SERVOS_ENABLED;
  }
  if (type == "speak") {
    const String audioUrl = payload["audio_url"] | "";
    return playWavUrl(audioUrl, payload["volume"] | 150);
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
      PendingEvent pending = {};
      while (eventQueue && xQueueReceive(eventQueue, &pending, 0) == pdTRUE) {
        if (!sendEventNow(pending.json)) {
          // Preserve the event and retry after the current network hiccup.
          xQueueSendToFront(eventQueue, &pending, 0);
          break;
        }
      }
      pollOnceInBackground();
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
  face("sleepy");
  M5StackChan.setServoPowerEnabled(SERVOS_ENABLED);
  if (SERVOS_ENABLED) M5StackChan.Motion.goHome(300);
  if (eventQueue) {
    xTaskCreatePinnedToCore(pollTask, "relay-poll", 8192, nullptr, 1, nullptr, 0);
  }
  connectWifi();
}

void loop() {
  M5StackChan.update();
  connectWifi();

  if (restoreFaceAt && static_cast<int32_t>(millis() - restoreFaceAt) >= 0) {
    restoreFaceAt = 0;
    drawFace(faceBeforeTap.c_str());
  }

  // Read through M5Unified's event layer. Direct display.getTouch() stays at
  // zero with some CoreS3 + StackChan-BSP combinations even though the GT911
  // controller is active.
  const bool screenTouched = M5.Touch.getCount() > 0;
  if (screenTouched && !screenWasTouched) {
    const auto& touch = M5.Touch.getDetail(0);
    Serial.printf("[touch] screen x=%d y=%d\n", touch.x, touch.y);
    reportTap("screen");
  }
  screenWasTouched = screenTouched;

  if (M5StackChan.TouchSensor.wasPressed()) {
    reportTap("top_sensor");
  }

  delay(10);
}
