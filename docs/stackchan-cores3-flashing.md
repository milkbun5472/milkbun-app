# CoreS3 Stack-chan: selection, flashing and acceptance

## Firmware selection

Use the repository's `firmware/stackchan-cores3` PlatformIO project:

- Board: `m5stack-cores3` (ESP32-S3, 16 MiB flash / 8 MiB PSRAM).
- Hardware layer: M5Stack's official StackChan-BSP 1.1.0 (which owns the
  CoreS3 peripherals and the base's two feedback TTL servos).
- Network: outbound HTTPS polling; no MQTT, inbound port, FTP, LLM or cloud key.
- TTS: relay-generated short-lived WAV; CoreS3 only downloads and plays it.

The old JavaScript Stack-chan firmware remains useful as a design reference,
but is not the base for this CoreS3 remote client.

## Before flashing

Do not flash until all of these are known:

1. The label really says CoreS3 (not Core2/CoreS3 SE).
2. The base is the official `StackChanBase` with SCS0009 feedback TTL servos,
   not a generic PWM-servo adapter.
3. A USB data cable is used and `/dev/cu.usbmodem*` appears.
4. Existing SD-card contents are copied. If preserving the factory flash
   matters, make a full 16 MiB `esptool` backup first.

Servo output ships disabled for the first smoke test. The official BSP owns
the UART, servo IDs and calibration; do not replace it with `ESP32Servo` or
guess GPIO pins. Record the factory servo calibration before enabling motion.

## Build

Install PlatformIO Core, then:

```bash
cd /Users/lisa/Desktop/Lisa-phone/firmware/stackchan-cores3
python3 scripts/configure_local.py
pio run
```

The configurator prompts for Wi-Fi passwords without echoing them, reads the
device token from the relay's private `.env`, downloads and pins the public
ISRG Root X1 certificate, and writes mode-0600 `config.local.h`. The generated
file is ignored by Git.

## Backup and flash

Find the port:

```bash
ls /dev/cu.usbmodem*
```

Back up before first erase (replace the port):

```bash
pio pkg exec --package tool-esptoolpy -- esptool.py --chip esp32s3 \
  --port /dev/cu.usbmodemXXXX read_flash 0x0 0x1000000 cores3-factory-16m.bin
```

Keep the backup outside Git. Build and upload:

```bash
pio run
pio run --target upload --upload-port /dev/cu.usbmodemXXXX
pio device monitor --port /dev/cu.usbmodemXXXX --baud 115200
```

If upload cannot enter download mode, hold the bottom reset button as
documented by M5Stack while starting the upload, then release it when the
tool connects.

## First acceptance (servos still disabled)

1. Screen shows a face and serial reports the selected 2.4 GHz network.
2. Home Wi-Fi off: within the retry cycle it joins the phone hotspot.
3. Relay returns 204 repeatedly without memory growth or visible action.
4. `emote` changes the face once.
5. A screen tap creates exactly one idempotent `tap` event.
6. An expired command does nothing.
7. A WAV command plays once; replaying the same command ID does nothing.

Only then record the factory calibration, enable servos, and test `move` with
narrow limits while holding the robot clear of obstructions. Relay pitch
`90` maps to the physical 45-degree center; firmware clamps the physical
vertical servo to the official safe range of 5–85 degrees.

## Local motion library and quiet study

Motion choreography lives in `src/motion_library.h` as named, home-relative
keyframe timelines. The relay sends one preset name; the CoreS3 plays all
frames locally, so a dance does not turn into several network round trips.

Quiet-study acceptance:

1. Send `move.preset=study_read`: the face becomes a downcast reading face and
   the head settles into the reading pose.
2. Leave it untouched for at least 25 seconds: one or more small page-turn
   motions play, and every one settles back into the reading pose.
3. Lightly pat the head for less than 1.2 seconds, or tap the screen: it looks
   up and smiles, then returns to its reading face and pose after about three
   seconds.
4. Hold the head for at least 1.2 seconds: voice recording opens instead of
   treating the hold as a study-exit tap.
5. Send `move.preset=study_lookup`: it looks up and leaves study mode for real.

## Rollback

With the saved image:

```bash
pio pkg exec --package tool-esptoolpy -- esptool.py --chip esp32s3 \
  --port /dev/cu.usbmodemXXXX write_flash 0x0 cores3-factory-16m.bin
```

If there is no backup yet, stop. Do not erase the device merely to discover
whether the cable works.
