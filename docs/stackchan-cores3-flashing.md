# CoreS3 Stack-chan: selection, flashing and acceptance

## Firmware selection

Use the repository's `firmware/stackchan-cores3` PlatformIO project:

- Board: `m5stack-cores3` (ESP32-S3, 16 MiB flash / 8 MiB PSRAM).
- Hardware layer: M5Unified + M5GFX.
- Network: outbound HTTPS polling; no MQTT, inbound port, FTP, LLM or cloud key.
- TTS: relay-generated short-lived WAV; CoreS3 only downloads and plays it.

The old JavaScript Stack-chan firmware remains useful as a design reference,
but is not the base for this CoreS3 remote client. M5Stack's old dedicated
CoreS3 library is deprecated in favor of M5Unified.

## Before flashing

Do not flash until all of these are known:

1. The label really says CoreS3 (not Core2/CoreS3 SE).
2. The exact Stack-chan base/servo adapter and its yaw/pitch wiring.
3. A USB data cable is used and `/dev/cu.usbmodem*` appears.
4. Existing SD-card contents are copied. If preserving the factory flash
   matters, make a full 16 MiB `esptool` backup first.

Servo output ships disabled. Wrong pins can fight the power controller or
speaker; set them only after checking the arrived base.

## Build

Install PlatformIO Core, then:

```bash
cd /Users/lisa/Desktop/Lisa-phone/firmware/stackchan-cores3
cp include/config.example.h include/config.local.h
pio run
```

Edit only `config.local.h` for the two Wi-Fi networks, device ID, token,
Funnel URL and root CA. This file is ignored by Git.

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

Only then verify the base pinout, enable servos, and test `move` with narrow
limits while holding the robot clear of obstructions.

## Rollback

With the saved image:

```bash
pio pkg exec --package tool-esptoolpy -- esptool.py --chip esp32s3 \
  --port /dev/cu.usbmodemXXXX write_flash 0x0 cores3-factory-16m.bin
```

If there is no backup yet, stop. Do not erase the device merely to discover
whether the cable works.

