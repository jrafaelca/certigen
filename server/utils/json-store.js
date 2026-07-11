import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { nowIso } from './utils.js';

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tempPath, body, 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function removeIfExists(filePath) {
  try {
    await fs.rm(filePath, { force: true });
  } catch {}
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(dir, suffix = '') {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((entry) => entry.endsWith(suffix)).map((entry) => path.join(dir, entry));
  } catch {
    return [];
  }
}

export function touchIso() {
  return nowIso();
}
