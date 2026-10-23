import net from 'net';
import {
  UnexpectedStateError,
} from '../errors';

export default (url: string) => {
  const urlTokens = new URL(url);

  if (urlTokens.search !== '') {
    throw new UnexpectedStateError('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have query.');
  }

  if (urlTokens.hash !== '') {
    throw new UnexpectedStateError('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have hash.');
  }

  if (urlTokens.protocol !== 'http:') {
    throw new UnexpectedStateError('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL protocol must be "http:".');
  }

  let hostname = urlTokens.hostname;

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    let unwrappedHostname = hostname.slice(1, -1);
    if (net.isIPv6(unwrappedHostname)) {
      hostname = unwrappedHostname;
    }
  }

  let port = 80;

  if (urlTokens.port) {
    port = Number.parseInt(urlTokens.port, 10);
  }

  let authorization = null;

  if (urlTokens.username && urlTokens.password) {
    authorization = urlTokens.username + ':' + urlTokens.password;
  } else if (urlTokens.username) {
    authorization = urlTokens.username;
  }

  return {
    authorization,
    hostname: hostname,
    port,
  };
};
