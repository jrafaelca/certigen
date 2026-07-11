import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';

export async function createZip(zipPath, sourceDir, rootFolderName) {
  await fsPromises.mkdir(path.dirname(zipPath), { recursive: true });

  return await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, rootFolderName);
    Promise.resolve(archive.finalize()).catch(reject);
  });
}
