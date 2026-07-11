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
