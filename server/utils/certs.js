import fs from 'node:fs/promises';
import path from 'node:path';
import { X509Certificate } from 'node:crypto';
import { sanitizeFilename } from './utils.js';

const PEM_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

export function splitPemChain(pemText) {
  return String(pemText).match(PEM_BLOCK) || [];
}

export function extractCertificateMetadata(certPem) {
  const certificate = new X509Certificate(certPem);
  return {
    serialNumber: certificate.serialNumber,
    fingerprintSha256: certificate.fingerprint256?.replace(/:/g, '').toLowerCase() || '',
    issuedAt: new Date(certificate.validFrom).toISOString(),
    expiresAt: new Date(certificate.validTo).toISOString(),
  };
}

export async function copyCertificateBundle({ sourceDir, exportDir, primaryDomain }) {
  await fs.mkdir(exportDir, { recursive: true, mode: 0o700 });

  const mapping = [
    ['cert.pem', 'certificate.pem'],
    ['chain.pem', 'chain.pem'],
    ['fullchain.pem', 'fullchain.pem'],
    ['privkey.pem', 'private-key.pem'],
  ];

  for (const [from, to] of mapping) {
    await fs.copyFile(path.join(sourceDir, from), path.join(exportDir, to));
  }

  const metadata = extractCertificateMetadata(await fs.readFile(path.join(exportDir, 'certificate.pem'), 'utf8'));
  const name = sanitizeFilename(primaryDomain);
  return { metadata, bundleDir: exportDir, bundleName: `${name}` };
}

export async function createMetadataFile(exportDir, payload) {
  await fs.writeFile(
    path.join(exportDir, 'metadata.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    { mode: 0o644 },
  );
}
