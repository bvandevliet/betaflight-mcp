# MCU / USB Driver Troubleshooting

Read this when `list_serial_ports` doesn't show the FC, `connect_flight_controller` fails, or the
user reports "no COM port" / "device not recognized". This blocks every other tool in this skill —
nothing else works until the serial connection is established.

Sources: [Betaflight Firmware Installation](https://github.com/betaflight/betaflight.com/blob/master/docs/wiki/getting-started/firmware-installation.md),
[Betaflight Troubleshooting](https://github.com/betaflight/betaflight.com/blob/master/docs/wiki/getting-started/troubleshooting.md),
[USB Flashing](https://github.com/betaflight/betaflight.com/blob/master/docs/wiki/guides/current/USB-Flashing.md).

## Two USB device classes

Every FC uses one of two USB architectures. Which one matters for which driver is needed.

1. **External USB-UART bridge chip** (Silabs CP210x, FTDI, CH340) — rare on modern FCs but common
   on some ESC programming adapters and older/budget boards. Needs the chip vendor's VCP driver
   on Windows; usually driverless on macOS/Linux.
2. **Native MCU USB** — the microcontroller itself implements USB. This covers essentially all
   current Betaflight targets: **STM32** (F4/F7/H7 — ST), **AT32F435** (Artery), **APM32F4**
   (Geehy), **GD32F4** (GigaDevice). All four are pin/peripheral-compatible Cortex-M4/M7 parts
   built for the same unified-target firmware, and all present the same two USB personalities:
   - **Normal/CDC mode** — shows as a `COMx` (Windows) / `/dev/ttyACM*` or `/dev/cu.usbmodem*`
     (Linux/macOS) virtual COM port. This is what the MCP server connects to for MSP/CLI.
   - **DFU/bootloader mode** — shows as `STM32 BOOTLOADER` (or equivalent) for firmware flashing
     only. Not used by this skill's normal tools — flag it if a user is stuck here (see below).

## Windows

- **Windows 10 and later**: in most cases **no STM32 VCP driver install is needed** — Windows
  ships a generic driver that works. If a COM port still doesn't appear, try the
  [ImpulseRC Driver Fixer](https://github.com/ImpulseRC/ImpulseRC_Driver_Fixer) first — it
  installs the correct driver set automatically for most native-USB FCs and is the officially
  recommended first step in Betaflight's own troubleshooting doc.
- If the Driver Fixer doesn't resolve it, install the **STMicro VCP driver** manually
  (`http://www.st.com/web/en/catalog/tools/PF257938`) — note the downloaded installer only
  *unpacks* the driver; you then have to run the architecture-specific `dpinst_amd64.exe` or
  `dpinst_x86.exe` from the extracted folder.
- **Stuck in DFU/bootloader mode, need it back in CDC/normal mode**: this needs
  [Zadig](https://zadig.akeo.ie/) — Options → List All Devices → select `STM32 BOOTLOADER` →
  choose `WinUSB` → Install Driver. This is a **flashing-recovery** step, not something this
  skill's tools do routinely; only walk a user through it if they describe being stuck at a DFU
  device with no normal COM port after a failed/interrupted flash.
- **Port shows up but the MCP server can't open it**: something else already holds the port —
  most commonly **Betaflight Configurator running at the same time**. Also check 3D-printing
  software (common culprit per official docs) and any other serial monitor. Close the other
  application and retry `connect_flight_controller`.
- **Port disappeared after enabling HID joystick emulation**: HID mode replaces the serial
  device. There's no fix from this skill's side — the user must disable HID (or enable
  "Show all serial devices" in Configurator) to get the COM port back.

## macOS

Native-USB FCs are normally driverless on macOS. If a rare CH340-based clone board doesn't show
up, that specific chip needs its own driver — but this is uncommon for current Betaflight targets.

## Linux

No product-specific driver is needed, but **permissions** block access by default:

```bash
# Add yourself to the group that owns the serial device (usually dialout; plugdev on Ubuntu for DFU)
sudo usermod -a -G dialout $USER
```

Log out and back in (or reboot) for the group change to take effect — a common miss.

**For DFU-mode access** (bootloader, not needed for this skill's normal tools), a udev rule is
required for STM32 *and* AT32 (both use the same DFU class):

```bash
(echo '# DFU (Internal bootloader for STM32 and AT32 MCUs)'
 echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="2e3c", ATTRS{idProduct}=="df11", MODE="0664", GROUP="plugdev"'
 echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="df11", MODE="0664", GROUP="plugdev"') \
 | sudo tee /etc/udev/rules.d/45-stdfu-permissions.rules > /dev/null
```

**Device appears then immediately disappears** (`/dev/ttyUSB*`/`/dev/ttyACM*` flashes and vanishes
right after plugging in): `ModemManager` is grabbing the port thinking it's a cellular modem.

```bash
sudo systemctl stop ModemManager.service
```

**Port stuck in a bad state** after another program (ESC flashing tool, config script) left it in
a non-default mode without resetting it:

```bash
stty sane -F /dev/<your port>
```

## Diagnostic checklist — no COM port at all

Work through in this order before assuming a driver problem:

1. **Cable**: many USB cables are charge-only (no data lines). Confirm the same cable transfers
   data with another device, or just swap cables.
2. **Correct port on the craft**: on boards with multiple USB-capable connectors (e.g. an
   integrated DJI/analog VTX unit with its own USB), confirm the cable is in the FC's USB port,
   not a peripheral's.
3. **Another application holding the port** — Betaflight Configurator, ESC config tools, 3D
   printing software.
4. **Driver** — ImpulseRC Driver Fixer (Windows) or the platform-specific steps above.
5. **Dead MCU / bricked board** — only after 1–4 are ruled out. Symptoms are identical between a
   fried CPU and one with corrupted/missing firmware; a multimeter reading near-zero resistance
   between the 3.3V pad and ground (vs. mid-to-high kΩ on a healthy board) indicates a dead
   regulator/MCU — outside what this skill or the MCP server can fix.

## Relevance to this skill's tools

`list_serial_ports` will simply not list a device with no driver or a fully dead MCU — it isn't a
bug in the MCP server if the port never appears. `connect_flight_controller` failing on a port
that *does* appear in the OS device list almost always means another process has it open
(Configurator is the most common conflict during a live-tuning session run alongside this skill).
