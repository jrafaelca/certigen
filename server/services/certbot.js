import path from 'node:path';
import { spawn } from 'node:child_process';
import { sanitizeFilename } from '../utils/utils.js';

function hookPath(name) {
  return path.join(process.cwd(), 'server', 'certbot-hooks', name);
}

export function startCertbotProcess({ request, requestDir, paths, logger, onExit, onOutput }) {
  const certbotBin = process.env.CERTBOT_BIN || 'certbot';
  const args = [
    'certonly',
    '--manual',
    '--preferred-challenges',
    'dns',
    '--manual-auth-hook',
    hookPath('auth-hook.js'),
    '--manual-cleanup-hook',
    hookPath('cleanup-hook.js'),
    '--manual-public-ip-logging-ok',
    '--agree-tos',
    '--no-eff-email',
    '--non-interactive',
    '--email',
    request.email,
    '--config-dir',
    paths.certbotConfigDir,
    '--work-dir',
    paths.certbotWorkDir,
    '--logs-dir',
    paths.certbotLogsDir,
    '--cert-name',
    sanitizeFilename(request.requestId),
  ];

  for (const domain of request.domains) {
    args.push('-d', domain);
  }

  const acmeDirectoryUrl = process.env.ACME_DIRECTORY_URL || '';
  if (acmeDirectoryUrl) {
    args.push('--server', acmeDirectoryUrl);
  } else if (String(process.env.ACME_STAGING || 'false') === 'true') {
    args.push('--staging');
  }

  const env = {
    ...process.env,
    REQUEST_ID: request.requestId,
    REQUEST_DIR: requestDir,
    REQUEST_SIGNAL_DIR: paths.signalsDir,
    REQUEST_CHALLENGE_DIR: paths.challengesDir,
    REQUEST_LOG_DIR: paths.logsDir,
  };

  const child = spawn(certbotBin, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const output = chunk.toString().trim();
    if (output) {
      onOutput?.(`stdout ${output}`);
    }
    logger.info(
      {
        event: 'certbot.stdout',
        request_id: request.requestId,
        output,
      },
      'certbot output',
    );
  });

  child.stderr.on('data', (chunk) => {
    const output = chunk.toString().trim();
    if (output) {
      onOutput?.(`stderr ${output}`);
    }
    logger.warn(
      {
        event: 'certbot.stderr',
        request_id: request.requestId,
        output,
      },
      'certbot output',
    );
  });

  child.on('error', (error) => {
    logger.error({ event: 'certbot.spawn_error', request_id: request.requestId, error: error.message }, 'certbot spawn failed');
    onExit(error, null);
  });

  child.on('close', (code, signal) => {
    onExit(null, { code, signal });
  });

  return child;
}
