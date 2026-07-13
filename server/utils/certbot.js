import { stripAnsi } from './utils.js';

export function parseChallengeDetails(text) {
  const clean = stripAnsi(text);
  const match = clean.match(
    /Please deploy a DNS TXT record under the name\s+([^\s]+)\s+with the following value:\s+([A-Za-z0-9_-]+)\b/s,
  );

  if (match) {
    return {
      recordName: match[1].trim(),
      recordValue: match[2].trim(),
    };
  }

  const nameMatch = clean.match(/Please deploy a DNS TXT record under the name\s+([^\s]+)/s);
  const valueMatch = clean.match(/with the following value:\s*([A-Za-z0-9_-]+)/s);

  if (nameMatch && valueMatch) {
    return {
      recordName: nameMatch[1].trim(),
      recordValue: valueMatch[1].trim(),
    };
  }

  return null;
}

const ignoredFailurePatterns = [
  /^Ask for help or search for solutions at https:\/\/community\.letsencrypt\.org\./i,
  /^See the logfile .* or re-run Certbot with -v for more details\.$/i,
  /^Some challenges have failed\.$/i,
  /^Certbot failed to authenticate some domains \(authenticator: manual\)\.$/i,
  /^Hint:/i,
  /^stderr\s+Node\.js v\d+/i,
  /^stderr\s+Node\.js v\d+\.\d+\.\d+/i,
];

export function extractCertbotFailureMessage(lines = [], fallback = 'Unexpected error.') {
  const normalizedLines = [...lines]
    .map((line) => String(line ?? '').trim())
    .filter(Boolean)
    .reverse();

  for (const line of normalizedLines) {
    const message = line.replace(/^(stderr|stdout|error)\s+/i, '').trim();
    if (!message) continue;

    if (ignoredFailurePatterns.some((pattern) => pattern.test(message))) {
      continue;
    }

    const moduleNotFoundMatch = message.match(/Cannot find module ['"]([^'"]+)['"]/i);
    if (moduleNotFoundMatch) {
      return `Certbot hook could not load ${moduleNotFoundMatch[1]}.`;
    }

    if (/Cannot find module/i.test(message) || /MODULE_NOT_FOUND/i.test(message)) {
      return 'Certbot hook could not load a required module.';
    }

    const dnsProblemMatch = message.match(/DNS problem:\s*(.+)$/i);
    if (dnsProblemMatch) {
      return `DNS problem: ${dnsProblemMatch[1].trim()}`;
    }

    const timeoutMatch = message.match(/Timeout waiting for\s+(.+)$/i);
    if (timeoutMatch) {
      return `Certbot timed out waiting for DNS propagation for ${timeoutMatch[1].trim()}.`;
    }

    if (/Hook '.*' for .* ran with error output:/i.test(message)) {
      continue;
    }

    if (/Hook '.*' for .* reported error code \d+/i.test(message)) {
      continue;
    }

    return message;
  }

  return fallback;
}
