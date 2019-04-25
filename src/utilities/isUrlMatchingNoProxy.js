// @flow

import {
  parse as parseUrl
} from 'url';
import matcher from 'matcher';
import {
  UnexpectedStateError
} from '../errors';

export default (subjectUrl: string, noProxy: string) => {
  const subjectUrlTokens = parseUrl(subjectUrl);

  const rules = noProxy.split(/[,\s]/);

  for (const rule of rules) {
    const ruleMatch = rule.match(/^(?<hostname>.+?)(?::(?<port>\d+))?$/);

    if (!ruleMatch || !ruleMatch.groups) {
      throw new UnexpectedStateError('Invalid NO_PROXY pattern.');
    }

    if (!ruleMatch.groups.hostname) {
      throw new UnexpectedStateError('NO_PROXY entry pattern must include hostname. Use * to match any hostname.');
    }

    if ((subjectUrlTokens.port || ruleMatch.groups.port) && subjectUrlTokens.port !== ruleMatch.groups.port) {
      continue;
    }

    if (matcher.isMatch(subjectUrlTokens.hostname, ruleMatch.groups.hostname)) {
      return true;
    }
  }

  return false;
};
