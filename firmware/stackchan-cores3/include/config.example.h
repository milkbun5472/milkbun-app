#pragma once

// Copy this file to include/config.local.h. Never commit config.local.h.
// CoreS3 only supports 2.4 GHz Wi-Fi.
struct WifiCredential {
  const char* ssid;
  const char* password;
};

static const WifiCredential WIFI_NETWORKS[] = {
  {"HOME_WIFI_2G", "replace-me"},
  {"PHONE_HOTSPOT_2G", "replace-me"},
};

static constexpr char DEVICE_ID[] = "stackchan-core-s3-CHANGE-ME";
static constexpr char RELAY_BASE_URL[] = "https://CHANGE-ME.ts.net";
static constexpr char DEVICE_BEARER_TOKEN[] = "replace-with-a-long-random-token";

// Put the CA certificate used by the Funnel HTTPS endpoint here.
// Leave empty only for the first USB/local smoke test; production refuses it.
static constexpr char RELAY_ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
REPLACE ME
-----END CERTIFICATE-----
)PEM";

// Polling and safety.
static constexpr unsigned long POLL_INTERVAL_MS = 1500;
static constexpr unsigned long WIFI_RETRY_MS = 10000;
static constexpr size_t MAX_AUDIO_BYTES = 1536 * 1024;

// Servo pins depend on the exact Stack-chan base/adapter. Do not enable until
// the wiring has been checked against the arrived unit.
static constexpr bool SERVOS_ENABLED = false;
static constexpr int SERVO_YAW_PIN = -1;
static constexpr int SERVO_PITCH_PIN = -1;
static constexpr int SERVO_YAW_MIN = 35;
static constexpr int SERVO_YAW_MAX = 145;
static constexpr int SERVO_PITCH_MIN = 55;
static constexpr int SERVO_PITCH_MAX = 125;

