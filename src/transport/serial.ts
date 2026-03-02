import { SerialPort } from 'serialport';
import type { SerialPortInfo } from '../types/betaflight.js';

type DataListener = (chunk: Buffer) => void;

let _connection: SerialTransport | null = null;

export class SerialTransport {
  private port: SerialPort;
  private dataListeners: Set<DataListener> = new Set();
  private closeCallbacks: Array<() => void> = [];

  private constructor(port: SerialPort) {
    this.port = port;
  }

  static async connect(path: string, baudRate = 115200): Promise<SerialTransport> {
    if (_connection) {
      await _connection.close();
    }
    const port = new SerialPort({ path, baudRate, autoOpen: false });
    return new Promise<SerialTransport>((resolve, reject) => {
      port.open((err) => {
        if (err) {
          reject(err);
          return;
        }
        const transport = new SerialTransport(port);
        port.on('data', (chunk: Buffer) => {
          for (const listener of transport.dataListeners) {
            listener(chunk);
          }
        });
        port.on('close', () => {
          _connection = null;
          for (const cb of transport.closeCallbacks) {
            cb();
          }
        });
        port.on('error', (err) => {
          process.stderr.write(`[serial] error: ${String(err)}\n`);
        });
        _connection = transport;
        resolve(transport);
      });
    });
  }

  static async listPorts(): Promise<SerialPortInfo[]> {
    const ports = await SerialPort.list();
    return ports.map((p) => {
      const info: SerialPortInfo = { path: p.path };
      if (p.manufacturer !== undefined) info.manufacturer = p.manufacturer;
      if (p.serialNumber !== undefined) info.serialNumber = p.serialNumber;
      if (p.pnpId !== undefined) info.pnpId = p.pnpId;
      if (p.locationId !== undefined) info.locationId = p.locationId;
      if (p.productId !== undefined) info.productId = p.productId;
      if (p.vendorId !== undefined) info.vendorId = p.vendorId;
      return info;
    });
  }

  write(data: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.port.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
        this.port.drain((err2) => {
          if (err2) {
            reject(err2);
          } else {
            resolve();
          }
        });
      });
    });
  }

  addDataListener(cb: DataListener): void {
    this.dataListeners.add(cb);
  }

  removeDataListener(cb: DataListener): void {
    this.dataListeners.delete(cb);
  }

  onClose(cb: () => void): void {
    this.closeCallbacks.push(cb);
  }

  close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.port.isOpen) {
        resolve();
        return;
      }
      this.port.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  get isOpen(): boolean {
    return this.port.isOpen;
  }
}

export function getConnection(): SerialTransport | null {
  return _connection;
}
