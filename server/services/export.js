import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { createZip } from '../utils/zip.js';
import { copyCertificateBundle, createMetadataFile } from '../utils/certs.js';
import { uuid, sanitizeFilename } from '../utils/utils.js';
import { downloadPaths } from './paths.js';

export async function packageCertificate({ request, paths, dataDir, logger }) {
  const downloadUuid = uuid();
  const downloadInfo = downloadPaths(dataDir, downloadUuid);
  const requestFolderName = sanitizeFilename(request.primaryDomain || request.requestId);
  const exportDir = downloadInfo.exportsDir;

  await fsPromises.mkdir(exportDir, { recursive: true, mode: 0o700 });

  const liveDir = path.join(paths.certbotConfigDir, 'live', sanitizeFilename(request.requestId));
  const bundle = await copyCertificateBundle({
    sourceDir: liveDir,
    exportDir,
    primaryDomain: request.primaryDomain,
  });

  const metadata = {
    primaryDomain: request.primaryDomain,
    domains: request.domains,
    issuer: request.certificateAuthority === 'zerossl' ? 'ZeroSSL' : "Let's Encrypt",
    issuedAt: bundle.metadata.issuedAt,
    expiresAt: bundle.metadata.expiresAt,
    serialNumber: bundle.metadata.serialNumber,
    fingerprintSha256: bundle.metadata.fingerprintSha256,
  };

  await createMetadataFile(exportDir, metadata);

  const zipPath = downloadInfo.zipPath;
  await createZip(zipPath, exportDir, requestFolderName);

  await fsPromises.writeFile(
    downloadInfo.metadataPath,
    `${JSON.stringify(
      {
        downloadUuid,
        requestId: request.requestId,
        requestFolderName,
        filename: `${request.primaryDomain}-certificates.zip`,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + request.downloadTtlMinutes * 60_000).toISOString(),
        remainingDownloads: request.downloadMaxCount,
      },
      null,
      2,
    )}\n`,
    { mode: 0o644 },
  );

  logger.info({ event: 'bundle.packaged', request_id: request.requestId, download_id: downloadUuid }, 'certificate bundle packaged');

  return {
    downloadUuid,
    zipPath,
    metadata,
    requestFolderName,
    exportDir,
    filename: `${request.primaryDomain}-certificates.zip`,
  };
}
