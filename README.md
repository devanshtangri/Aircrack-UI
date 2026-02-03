# Aircrack-UI

Aircrack-UI is a web-based graphical interface for **aircrack-ng**, designed to simplify Wi-Fi security testing by providing an intuitive and efficient user interface. It removes the need to manually run complex terminal commands while retaining full control over common wireless attack workflows.

---

## Problem It Solves

Aircrack-ng is powerful but heavily command-line driven, which can be error-prone and inconvenient during testing.  
Aircrack-UI provides a **user-friendly web interface** that makes wireless security testing faster, clearer, and more accessible.

---

## Key Features

- Web-based UI for aircrack-ng
- Two attack modes:
  - **Handshake Capture**
  - **Deauthentication (Deauth) Attack**
- Select **multiple Wi-Fi networks** for deauth attacks
- Select **multiple wireless adapters** to distribute attack load
- Real-time interaction through the web interface
- Download captured **`.cap` files directly from the UI**
- Built using Flask, Socket.IO, and Scapy

---

## Installation

Install all required dependencies with a single command:

```bash
sudo apt install python3-flask python3-socketio python3-scapy aircrack-ng
```

---

## Raspberry Pi Portable Setup (Recommended Use Case)

Aircrack-UI can be run on a **Raspberry Pi** to create a fully portable wireless testing device.

### Concept

- Run Aircrack-UI on a Raspberry Pi
- Use the **internal Wi-Fi adapter** to host a hotspot
- Connect to the hotspot using a phone or laptop
- Open the web UI in a browser and perform attacks remotely

This effectively turns the Raspberry Pi into a **portable Wi-Fi auditing machine**.

---

## OS Recommendation (Important)

It is strongly recommended to use a **lightweight Linux distribution such as DietPi**.

### Why DietPi?

- Aircrack-ng uses `airmon-ng check kill`, which stops network services
- Heavier OSes may drop the hotspot when the script starts
- DietPi keeps networking stable while attacks are running
- Minimal background services reduce conflicts

---

## Hotspot Safety Configuration

To prevent accidentally attacking the Raspberry Pi’s own hotspot:

1. Open `main.py`
2. Locate **line 17**
3. Add the **BSSID of the Raspberry Pi hotspot** to the exclusion list

This ensures:
- The hotspot does **not appear in the UI**
- You cannot accidentally deauth or attack your own access point

This step is **highly recommended** when using the Raspberry Pi setup.

---

## Auto-Start on Boot (Systemd Service)

You can configure Aircrack-UI to start automatically when the Raspberry Pi boots.

### Example systemd service

Create a service file:
```bash
sudo nano /etc/systemd/system/aircrack-ui.service
