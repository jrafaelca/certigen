import path from 'node:path';

export function requestRoot(dataDir, requestId) {
  return path.join(dataDir, 'requests', requestId);
}

export function requestPaths(dataDir, requestId) {
  const root = requestRoot(dataDir, requestId);
  return {
    root,
    requestJson: path.join(root, 'request.json'),
    stateJson: path.join(root, 'state.json'),
    challengesDir: path.join(root, 'challenges'),
    signalsDir: path.join(root, 'signals'),
    logsDir: path.join(root, 'logs'),
    outputDir: path.join(root, 'output'),
    certbotConfigDir: path.join(dataDir, 'certbot', 'config'),
    certbotWorkDir: path.join(dataDir, 'certbot', 'work'),
    certbotLogsDir: path.join(dataDir, 'certbot', 'logs'),
    exportsDir: path.join(dataDir, 'exports', requestId),
    downloadsDir: path.join(dataDir, 'downloads'),
  };
}

export function downloadPaths(dataDir, downloadUuid) {
  return {
    zipPath: path.join(dataDir, 'downloads', `${downloadUuid}.zip`),
    metadataPath: path.join(dataDir, 'downloads', `${downloadUuid}.json`),
    exportsDir: path.join(dataDir, 'exports', downloadUuid),
  };
}
