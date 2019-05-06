// @flow

import EventEmitter from 'events';
import http from 'http';
import https from 'https';
import semver from 'semver';
import Logger from '../Logger';
import {
  HttpProxyAgent,
  HttpsProxyAgent
} from '../classes';
import {
  UnexpectedStateError
} from '../errors';
import {
  bindHttpMethod,
  isUrlMatchingNoProxy,
  parseProxyUrl
} from '../utilities';

const log = Logger.child({
  namespace: 'bootstrap'
});

export default () => {
  global.GLOBAL_AGENT = global.GLOBAL_AGENT || {};

  if (global.GLOBAL_AGENT.bootstrapped) {
    log.warn('found global.globalAgent; second attempt to bootstrap global-agent was ignored');

    return;
  }

  global.GLOBAL_AGENT.bootstrapped = true;

  // eslint-disable-next-line no-process-env
  global.GLOBAL_AGENT.HTTP_PROXY = process.env.GLOBAL_AGENT_HTTP_PROXY || null;

  // eslint-disable-next-line no-process-env
  global.GLOBAL_AGENT.NO_PROXY = process.env.GLOBAL_AGENT_NO_PROXY || null;

  log.info({
    configuration: global.GLOBAL_AGENT
  }, 'global agent has been initialized');

  const mustUrlUseProxy = (url) => {
    if (!global.GLOBAL_AGENT.HTTP_PROXY) {
      return false;
    }

    if (!global.GLOBAL_AGENT.NO_PROXY) {
      return true;
    }

    return !isUrlMatchingNoProxy(url, global.GLOBAL_AGENT.NO_PROXY);
  };

  const getUrlProxy = () => {
    if (!global.GLOBAL_AGENT.HTTP_PROXY) {
      throw new UnexpectedStateError('HTTP proxy must be configured.');
    }

    return parseProxyUrl(global.GLOBAL_AGENT.HTTP_PROXY);
  };

  const eventEmitter = new EventEmitter();

  const httpAgent = new HttpProxyAgent(
    mustUrlUseProxy,
    getUrlProxy,
    http.globalAgent,
    eventEmitter
  );

  const httpsAgent = new HttpsProxyAgent(
    mustUrlUseProxy,
    getUrlProxy,
    https.globalAgent,
    eventEmitter
  );

  // Overriding globalAgent was added in v11.7.
  // @see https://nodejs.org/uk/blog/release/v11.7.0/
  if (semver.gte(process.version, 'v11.7.0')) {
    // @see https://github.com/facebook/flow/issues/7670
    // $FlowFixMe
    http.globalAgent = httpAgent;

    // $FlowFixMe
    https.globalAgent = httpsAgent;
  } else {
    // $FlowFixMe
    http.get = bindHttpMethod(http.get, httpAgent);

    // $FlowFixMe
    http.request = bindHttpMethod(http.request, httpAgent);

    // $FlowFixMe
    https.get = bindHttpMethod(https.get, httpsAgent);

    // $FlowFixMe
    https.request = bindHttpMethod(https.request, httpsAgent);
  }
};
