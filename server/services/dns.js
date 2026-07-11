import dns from 'node:dns/promises';
import { flattenTxtAnswers } from '../utils/utils.js';

function normalizeResolver(resolver) {
  const value = String(resolver || 'system').trim();
  return value || 'system';
}

async function resolveTxtWithResolver(name, resolver) {
  if (resolver === 'system') {
    return dns.resolveTxt(name);
  }

  const custom = new dns.Resolver();
  custom.setServers([resolver]);
  return custom.resolveTxt(name);
}

export async function verifyDnsRecord({ recordName, expectedValue, resolvers }) {
  const checkedResolvers = (resolvers?.length ? resolvers : ['system', '1.1.1.1', '8.8.8.8']).map(normalizeResolver);
  let lastObserved = [];
  let statusRank = 0;
  let lastStatus = 'not_found';

  for (const resolver of checkedResolvers) {
    try {
      const answers = await resolveTxtWithResolver(recordName, resolver);
      const observed = flattenTxtAnswers(answers);
      lastObserved = observed;

      if (observed.includes(expectedValue)) {
        return {
          status: 'propagated',
          resolver,
          observed,
          checkedAt: new Date().toISOString(),
        };
      }

      const nextStatus = observed.length ? 'incorrect_value' : 'not_found';
      const nextRank = nextStatus === 'incorrect_value' ? 2 : 1;
      if (nextRank > statusRank) {
        statusRank = nextRank;
        lastStatus = nextStatus;
      }
    } catch (error) {
      const nextStatus = error?.code === 'ENODATA' || error?.code === 'ENOTFOUND' ? 'not_found' : 'failed';
      const nextRank = nextStatus === 'failed' ? 0 : 1;
      if (nextRank > statusRank) {
        statusRank = nextRank;
        lastStatus = nextStatus;
      }
    }
  }

  return {
    status: lastStatus === 'incorrect_value' ? 'incorrect_value' : lastStatus,
    observed: lastObserved,
    checkedAt: new Date().toISOString(),
  };
}
