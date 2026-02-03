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
