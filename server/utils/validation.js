import { normalizeDomain, isDangerousShellInput, parseList } from './utils.js';

const MAX_DOMAINS = 10;

function validateDomainSyntax(domain, { allowWildcard = false } = {}) {
  const value = normalizeDomain(domain);
  if (!value) {
    return { ok: false, error: 'The domain is required.' };
  }

  if (value.includes('://') || value.includes('/') || value.includes(':') || /\s/.test(value)) {
    return { ok: false, error: 'The domain cannot include a scheme, path, port, or spaces.' };
  }

  if (isDangerousShellInput(value)) {
    return { ok: false, error: 'The domain contains unsupported characters.' };
  }

  const wildcard = value.startsWith('*.');
  if (wildcard && !allowWildcard) {
    return { ok: false, error: 'Wildcard domains are only allowed in the wildcard field.' };
  }

  const ascii = wildcard ? value.slice(2) : value;
  if (!ascii || ascii.length > 253) {
    return { ok: false, error: 'The domain is invalid or too long.' };
  }

  const labels = ascii.split('.');
  if (labels.length < 2) {
    return { ok: false, error: 'The domain must include at least one dot.' };
  }

  for (const label of labels) {
    if (!label || label.length > 63) {
      return { ok: false, error: 'Each domain label must be between 1 and 63 characters.' };
    }

    if (!/^[a-z0-9-]+$/.test(label)) {
      return { ok: false, error: 'The domain may only use letters, numbers, and hyphens.' };
    }

    if (label.startsWith('-') || label.endsWith('-')) {
      return { ok: false, error: 'No label may start or end with a hyphen.' };
    }
  }

  return { ok: true, value };
}

export function validateEmail(input) {
  const email = String(input ?? '').trim();
  if (!email) {
    return { ok: false, error: 'The email address is required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'The email address is not valid.' };
  }

  return { ok: true, value: email };
}

export function validateRequestInput(payload) {
  const errors = [];

  const emailResult = validateEmail(payload?.email);
  if (!emailResult.ok) errors.push(emailResult.error);

  const hasDomainsField = Object.prototype.hasOwnProperty.call(payload || {}, 'domains');
  const domainCandidates = hasDomainsField
    ? parseList(payload?.domains)
    : [
        ...parseList(payload?.primaryDomain),
        ...parseList(payload?.additionalDomains),
      ];
  const domainValidations = domainCandidates.map((domain) => validateDomainSyntax(domain));
  const validDomains = domainValidations.filter((result) => result.ok).map((result) => result.value);
  const invalidDomains = domainValidations.filter((result) => !result.ok);

  if (invalidDomains.length) {
    errors.push('One or more domains are invalid.');
  }

  const wildcard = Boolean(payload?.wildcard);
  const primaryDomainValue = validDomains[0] || '';
  const wildcardDomain = wildcard && primaryDomainValue && !primaryDomainValue.startsWith('*.')
    ? validateDomainSyntax(`*.${primaryDomainValue}`, { allowWildcard: true })
    : { ok: true, value: primaryDomainValue.startsWith('*.') ? primaryDomainValue : null };
  if (!wildcardDomain.ok) errors.push(`Wildcard: ${wildcardDomain.error}`);

  const certificateAuthority = String(payload?.certificateAuthority || 'letsencrypt').toLowerCase();
  if (certificateAuthority !== 'letsencrypt') {
    errors.push('Invalid certificate authority.');
  }

  const resolvers = parseList(payload?.resolvers || 'system')
    .map((resolver) => resolver.trim())
    .filter(Boolean);

  const domains = [];
  const primaryDomain = validDomains[0] || '';
  const additionalDomains = [...new Set(validDomains.slice(1))];

  if (primaryDomain) domains.push(primaryDomain);
  if (wildcardDomain.ok && wildcardDomain.value) domains.push(wildcardDomain.value);
  domains.push(...additionalDomains);

  const dedupedDomains = [...new Set(domains)];
  if (!dedupedDomains.length) {
    errors.push('At least one domain is required.');
  }
  if (dedupedDomains.length > MAX_DOMAINS) {
    errors.push(`No more than ${MAX_DOMAINS} domains are allowed.`);
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      email: emailResult.value,
      primaryDomain: primaryDomain || dedupedDomains[0],
      additionalDomains,
      wildcard,
      certificateAuthority,
      domains: dedupedDomains,
      resolvers,
    },
  };
}

export function validateDownloadUuid(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}
