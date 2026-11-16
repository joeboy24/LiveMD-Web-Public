import { createReadStream, createWriteStream } from "node:fs";
import { open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

const table = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[n] = c >>> 0;
}

export function crc32(buffer: Buffer, seed = 0) {
  let c = (seed ^ 0xffffffff) >>> 0;
  for (let i = 0; i < buffer.length; i += 1) c = (table[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

export async function fileCrc(path: string) {
  const handle = await open(path, "r");
  const buffer = Buffer.alloc(1024 * 1024);
  let crc = 0;
  let size = 0;
  try {
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      crc = crc32(buffer.subarray(0, bytesRead), crc);
      size += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return { crc, size };
}

export async function writeStoreZip(destination: string, entries: { name: string; path: string }[]) {
  const stamp = dosTime(new Date());
  const prepared = [];
  for (const entry of entries) {
    const hashed = await fileCrc(entry.path);
    prepared.push({ ...entry, ...hashed });
  }
  const output = createWriteStream(destination);
  let offset = 0;
  const central: Buffer[] = [];
  try {
    for (const entry of prepared) {
      const header = localHeader(entry.name, entry.crc, entry.size, stamp);
      await send(output, header);
      await pipeline(createReadStream(entry.path), output, { end: false });
      central.push(centralHeader(entry.name, entry.crc, entry.size, offset, stamp));
      offset += header.length + entry.size;
    }
    const directory = Buffer.concat(central);
    await send(output, directory);
    await send(output, endRecord(prepared.length, directory.length, offset));
  } finally {
    await finished(output);
  }
}

function dosTime(date: Date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function localHeader(name: string, crc: number, size: number, stamp: { time: number; day: number }) {
  const file = Buffer.from(name);
  const header = Buffer.alloc(30 + file.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(stamp.time, 10);
  header.writeUInt16LE(stamp.day, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(file.length, 26);
  header.writeUInt16LE(0, 28);
  file.copy(header, 30);
  return header;
}

function centralHeader(name: string, crc: number, size: number, offset: number, stamp: { time: number; day: number }) {
  const file = Buffer.from(name);
  const header = Buffer.alloc(46 + file.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(stamp.time, 12);
  header.writeUInt16LE(stamp.day, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(size, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(file.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  file.copy(header, 46);
  return header;
}

function endRecord(count: number, size: number, offset: number) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(count, 8);
  header.writeUInt16LE(count, 10);
  header.writeUInt32LE(size, 12);
  header.writeUInt32LE(offset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

function send(stream: ReturnType<typeof createWriteStream>, chunk: Buffer) {
  return new Promise<void>((resolve, reject) => {
    stream.write(chunk, (error) => (error ? reject(error) : resolve()));
  });
}

function finished(stream: ReturnType<typeof createWriteStream>) {
  return new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
}
