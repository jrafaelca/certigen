import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildZipName,
  flattenTxtAnswers,
  normalizeDomain,
  parseList,
  normalizeDomainSet,
  sameDomainSet,
} from '../server/utils/utils.js';
import { validateDownloadUuid, validateEmail, validateRequestInput, validateSessionId } from '../server/utils/validation.js';
import { extractCertbotFailureMessage, parseChallengeDetails } from '../server/utils/certbot.js';

test('normalizes domains with uppercase letters and trailing dot', () => {
  assert.equal(normalizeDomain(' Ejemplo.COM. '), 'ejemplo.com');
});

test('validates email addresses', () => {
  assert.equal(validateEmail('admin@example.com').ok, true);
  assert.equal(validateEmail('admin@example').ok, false);
});

test('validates and normalizes a request', () => {
  const result = validateRequestInput({
    email: 'admin@example.com',
    domains: 'example.com, www.example.com\napi.example.com\nwww.example.com',
    wildcard: true,
    certificateAuthority: 'letsencrypt',
    resolvers: 'system, 1.1.1.1',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.additionalDomains, ['www.example.com', 'api.example.com']);
  assert.ok(result.value.domains.includes('example.com'));
  assert.ok(result.value.domains.includes('*.example.com'));
});

test('flattens TXT answers', () => {
  assert.deepEqual(flattenTxtAnswers([['abc'], ['def', 'ghi']]), ['abc', 'defghi']);
});

test('builds the zip name', () => {
  assert.equal(buildZipName('example.com'), 'example.com.zip');
});

test('parses Certbot DNS challenge output', () => {
  const sample = `
Please deploy a DNS TXT record under the name
_acme-challenge.example.com with the following value:
ABCDE12345
Before continuing, verify the DNS record is deployed.
`;

  assert.deepEqual(parseChallengeDetails(sample), {
    recordName: '_acme-challenge.example.com',
    recordValue: 'ABCDE12345',
  });
});

test('extracts the actionable Certbot failure message', () => {
  const sample = [
    "Hook '--manual-auth-hook' for example.com ran with error output:",
    " Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/server/utils/json-store.js' imported from /app/server/certbot-hooks/auth-hook.js",
    'Certbot failed to authenticate some domains (authenticator: manual).',
    'Some challenges have failed.',
    'Ask for help or search for solutions at https://community.letsencrypt.org. See the logfile /data/certbot/logs/letsencrypt.log or re-run Certbot with -v for more details.',
  ];

  assert.equal(
    extractCertbotFailureMessage(sample, 'Unexpected error.'),
    "Certbot hook could not load /app/server/utils/json-store.js.",
  );
});

test('validates download UUIDs', () => {
  assert.equal(validateDownloadUuid('3c608c2e-4b48-4655-b2f8-334e7603f6ef'), true);
  assert.equal(validateDownloadUuid('not-a-uuid'), false);
});

test('validates session UUIDs', () => {
  assert.equal(validateSessionId('3c608c2e-4b48-4655-b2f8-334e7603f6ef'), true);
  assert.equal(validateSessionId('not-a-session'), false);
});

test('splits lists separated by commas and newlines', () => {
  assert.deepEqual(parseList('a, b\nc'), ['a', 'b', 'c']);
});

test('normalizes and compares domain sets', () => {
  assert.deepEqual(normalizeDomainSet(['WWW.Example.com.', 'example.com', '*.Example.com']), [
    '*.example.com',
    'example.com',
    'www.example.com',
  ]);

  assert.equal(sameDomainSet(['example.com', 'www.example.com'], ['www.example.com', 'example.com']), true);
  assert.equal(sameDomainSet(['example.com'], ['example.com', 'www.example.com']), false);
  assert.equal(sameDomainSet([], ['example.com']), false);
});
