import { domainToASCII } from 'node:url';
import { randomUUID } from 'node:crypto';

export function normalizeDomain(input) {
  const raw = String(input ?? '').trim().toLowerCase().replace(/\.$/, '');
  return raw ? domainToASCII(raw) : '';
}

export function isDangerousShellInput(value) {
  return /[;&|`$<>]/.test(String(value));
}

export function buildZipName(domain) {
  return `${domain}.zip`;
}

export function sanitizeFilename(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function flattenTxtAnswers(answers) {
  const values = [];
  for (const answer of answers ?? []) {
    if (Array.isArray(answer)) {
      values.push(answer.join(''));
    }
  }
  return values.map((value) => value.trim()).filter(Boolean);
}

export function stripAnsi(text) {
  return String(text).replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uuid() {
  return randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseList(item));
  }

  return String(value ?? '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeDomainSet(domains) {
  return [...new Set(parseList(domains).map((domain) => normalizeDomain(domain)).filter(Boolean))].sort();
}

export function sameDomainSet(left, right) {
  const leftSet = normalizeDomainSet(left);
  const rightSet = normalizeDomainSet(right);

  if (leftSet.length !== rightSet.length) {
    return false;
  }

  return leftSet.every((domain, index) => domain === rightSet[index]);
}

export function toPositiveInt(value, fallback) {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
