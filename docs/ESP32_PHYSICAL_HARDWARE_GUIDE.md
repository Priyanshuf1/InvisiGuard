# InvisiGuard Physical ESP32 Hardware Guide

This document describes how to connect, flash, and run **real physical ESP32 hardware** with InvisiGuard. Both **USB Serial Cable** and **Wireless WiFi UDP** connections are supported out-of-the-box.

---

## 1. Supported Hardware & Protocols

### Supported Boards
- **ESP32 DevKit / WROOM-32 / NodeMCU-32S** (Standard 4MB / 16MB Flash)
- **ESP32-S3** (Native USB JTAG / UART, 512KB SRAM, High Packet Rate)
- **ESP32-C6 / C3** (802.11ax / 802.11b/g/n)

### Supported Ingestion Protocols
1. **Canonical ADR-018 Binary (`0xC5110001`)**:
   - 20-byte binary header with little-endian integer metadata + interleaved raw I/Q subcarrier bytes.
   - High efficiency (up to 1,000+ packets/sec with zero CPU serialization overhead).
2. **Espressif `esp-csi` & Arduino CSV (`CSI_DATA,...`)**:
   - Standard newline-delimited text formatted by Espressif's official `esp-csi` framework or custom Arduino sketches.
   - Supports bracketed subcarrier arrays `[I,Q,I,Q,...]` and unbracketed CSV tokens.

---

## 2. Connection Methods

### Method A: Plug-and-Play USB Serial Cable (Recommended)
1. Plug your ESP32 board into any USB port on your computer using a data-capable Micro-USB or USB-C cable.
2. The InvisiGuard backend automatically detects the connected COM port (filtering out non-device Bluetooth virtual links):
   - Probes at **921,600 baud** (high-throughput) and **115,200 baud** (standard).
3. Within **500 ms** of the first decoded frame, the web interface automatically transitions from `DEMO SIMULATION` to:
   ```
   ● LIVE CSI · 1 NODE (X PKTS)
   ```
   with live hardware SNR, packet reception rate, and subcarrier amplitudes.

### Method B: Wireless WiFi UDP Streaming
1. Connect your ESP32 to your local 2.4 GHz WiFi router or host AP.
2. Direct the ESP32 UDP socket to send CSI datagrams to your computer's IP address on **UDP Port 5005**:
   ```
   IP:   192.168.x.x (or 127.0.0.1 for local testing)
   Port: 5005
   ```
3. The server's `Esp32UdpReceiver` receives the frames and immediately routes them to the DSP motor notch filter and ML classifier.

---

## 3. Flashing Pre-Built Binaries (Zero Compilation)

If you already have Python and `esptool` installed (`pip install esptool pyserial`):

### For Standard ESP32 (4MB Flash):
```bash
python -m esptool --chip esp32 --port COMx --baud 921600 write_flash -z \
  0x1000  firmware/esp32-csi-node/release_bins/bootloader.bin \
  0x8000  firmware/esp32-csi-node/release_bins/partition-table-4mb.bin \
  0x10000 firmware/esp32-csi-node/release_bins/esp32-csi-node-4mb.bin
```
*(Replace `COMx` with your board's serial port, e.g. `COM3` or `/dev/ttyUSB0`)*

### For ESP32-S3:
```bash
python -m esptool --chip esp32s3 --port COMx --baud 921600 write_flash -z \
  0x0000  firmware/esp32-csi-node/release_bins/s3-adr110/bootloader.bin \
  0x8000  firmware/esp32-csi-node/release_bins/s3-adr110/partition-table.bin \
  0x10000 firmware/esp32-csi-node/release_bins/s3-adr110/esp32-csi-node.bin
```

---

## 4. Arduino IDE Sketch (Custom CSI Node)

If you prefer using Arduino IDE without compiling ESP-IDF, use this sketch:

```cpp
#include <WiFi.h>
#include "esp_wifi.h"

#define TARGET_UDP_IP   "192.168.1.100"  // Your computer's IP
#define TARGET_UDP_PORT 5005
#define SERIAL_BAUD     115200

WiFiUDP udp;

void wifi_csi_rx_cb(void *ctx, wifi_csi_info_t *info) {
    if (!info || !info->buf) return;
    wifi_csi_data_t *csi_data = &info->len;
    
    // Format: CSI_DATA,type,seq,mac,rssi,rate,...[I,Q,...]
    char mac_str[20];
    snprintf(mac_str, sizeof(mac_str), "%02X:%02X:%02X:%02X:%02X:%02X",
             info->mac[0], info->mac[1], info->mac[2],
             info->mac[3], info->mac[4], info->mac[5]);

    // Print to USB Serial (Universal Parser auto-decodes this format)
    Serial.printf("CSI_DATA,CSI_DATA,1,%s,%d,24,0,0,0,0,0,0,0,0,0,-95,0,6,0,1234567,1,%d,0,%d,0,\"[",
                  mac_str, info->rx_ctrl.rssi, info->len, info->len);
    
    int8_t *data = (int8_t *)info->buf;
    for (int i = 0; i < info->len; i++) {
        Serial.printf("%d%s", data[i], (i < info->len - 1) ? "," : "");
    }
    Serial.println("]\"");
}

void setup() {
    Serial.begin(SERIAL_BAUD);
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));
    wifi_csi_config_t csi_config = {
        .lltf_en = true,
        .htltf_en = true,
        .stbc_htltf2_en = true,
        .ltf_merge_en = true,
        .channel_filter_en = false,
        .manu_scale = false,
        .shift = false,
    };
    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&csi_config));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(wifi_csi_rx_cb, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_csi(true));
}

void loop() {
    delay(100);
}
```

---

## 5. Verification Checklist

To verify that your physical hardware is communicating with the system:

1. **Check Backend Status Endpoint**:
   ```bash
   curl http://localhost:3000/api/v1/hardware/status
   ```
   Response shows:
   ```json
   {
     "status": "connected",
     "connected": true,
     "port": "COM3",
     "transport": "serial",
     "packet_rate_hz": 20.4,
     "snr_db": 52.0
   }
   ```

2. **Run Verification Test Suite**:
   ```bash
   python scripts/verify_esp32_hardware_support.py
   ```
   Confirms all 5 tests pass:
   - Universal binary + CSV parsing
   - Sub-5ms DSP fan/cooler motor filtering
   - USB Serial non-blocking scan
   - UDP 5005 and serial frame routing
   - Live WebSocket UI promotion

3. **Check Frontend UI**:
   Open `http://localhost:3000/invisiguard` in Chrome/Edge. Top status indicator will illuminate green:
   ```
   ● LIVE CSI · 1 NODE (1240 PKTS)
   ```
