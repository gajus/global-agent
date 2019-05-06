// @flow

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
  isUrlMatchingNoProxy,
  parseProxyUrl
} from '../utilities';

const log = Logger.child({
  namespace: 'bootstrap'
});

const bindHttpMethod = (originalMethod, agent) => {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  return (...args) => {
    let url;
    let options;
    let callback;

    if (typeof args[0] === 'string') {
      url = args[0];

      if (typeof args[1] === 'function') {
        options = {};
        callback = args[1];
      } else {
        options = {
          ...args[1]
        };
        callback = args[2];
      }
    } else {
      options = {
        ...args[0]
      };
      callback = args[1];
    }

    if (!options.agent) {
      options.agent = agent;
    }

    // `request` module sets `agent` property to `http.globalAgent`/ `https.globalAgent` by default.
    if (options.agent === http.globalAgent || options.agent === https.globalAgent) {
      options.agent = agent;
    }

    if (url) {
      // $FlowFixMe
      return originalMethod(url, options, callback);
    } else {
      return originalMethod(options, callback);
    }
  };
};

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

  const httpAgent = new HttpProxyAgent(
    mustUrlUseProxy,
    getUrlProxy,
    http.globalAgent
  );

  const httpsAgent = new HttpsProxyAgent(
    mustUrlUseProxy,
    getUrlProxy,
    https.globalAgent
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
