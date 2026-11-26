import matcher from 'matcher';
import {
  UnexpectedStateError,
} from '../errors';

export default (subjectUrl: string, noProxy: string) => {
  const subjectUrlTokens = new URL(subjectUrl);

  const rules = noProxy.split(/[\s,]+/).filter(Boolean);

  for (const rule of rules) {
    const ruleMatch = rule
      .match(/^(?<hostname>.+?)(?::(?<port>\d+))?$/);

    if (!ruleMatch || !ruleMatch.groups) {
      throw new UnexpectedStateError('Invalid NO_PROXY pattern.');
    }

    if (!ruleMatch.groups.hostname) {
      throw new UnexpectedStateError('NO_PROXY entry pattern must include hostname. Use * to match any hostname.');
    }

    const ruleHostname = ruleMatch.groups.hostname;

    // A leading dot (".foo.com") matches the domain itself and any of its subdomains,
    // but not a host that only ends with the same string (e.g. "barfoo.com").
    const hostnameIsMatch = ruleHostname.startsWith('.') ?
      matcher.isMatch(subjectUrlTokens.hostname, ruleHostname.slice(1)) || matcher.isMatch(subjectUrlTokens.hostname, '*' + ruleHostname) :
      matcher.isMatch(subjectUrlTokens.hostname, ruleHostname);

    if (hostnameIsMatch && (!ruleMatch.groups || !ruleMatch.groups.port || subjectUrlTokens.port && subjectUrlTokens.port === ruleMatch.groups.port)) {
      return true;
    }
  }

  return false;
};
