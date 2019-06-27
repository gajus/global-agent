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
import type {
  ProxyAgentConfigurationInputType,
  ProxyAgentConfigurationType
} from '../types';
import createProxyController from './createProxyController';

// Save a reference to the original methods, that we might be overloading later
const httpGet = http.get;
const httpRequest = http.request;
const httpsGet = https.get;
const httpsRequest = https.request;

const defaultConfigurationInput = {
  environmentVariableNamespace: undefined
};

const log = Logger.child({
  namespace: 'createGlobalProxyAgent'
});

const createConfiguration = (configurationInput: ProxyAgentConfigurationInputType): ProxyAgentConfigurationType => {
  // eslint-disable-next-line no-process-env
  const DEFAULT_ENVIRONMENT_VARIABLE_NAMESPACE = typeof process.env.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE === 'string' ? process.env.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE : 'GLOBAL_AGENT_';

  return {
    ...configurationInput,
    environmentVariableNamespace: typeof configurationInput.environmentVariableNamespace === 'string' ? configurationInput.environmentVariableNamespace : DEFAULT_ENVIRONMENT_VARIABLE_NAMESPACE
  };
};

export default (configurationInput: ProxyAgentConfigurationInputType = defaultConfigurationInput) => {
  const configuration = createConfiguration(configurationInput);

  const proxyController = createProxyController();

  // eslint-disable-next-line no-process-env
  proxyController.HTTP_PROXY = process.env[configuration.environmentVariableNamespace + 'HTTP_PROXY'] || null;

  // eslint-disable-next-line no-process-env
  proxyController.HTTPS_PROXY = process.env[configuration.environmentVariableNamespace + 'HTTPS_PROXY'] || null;

  // eslint-disable-next-line no-process-env
  proxyController.NO_PROXY = process.env[configuration.environmentVariableNamespace + 'NO_PROXY'] || null;

  log.info({
    configuration: proxyController
  }, 'global agent has been initialized');

  const isProxyConfigured = (getProxy) => {
    return () => {
      return getProxy();
    };
  };

  const mustUrlUseProxy = (getProxy) => {
    return (url) => {
      if (!getProxy()) {
        return false;
      }

      if (!proxyController.NO_PROXY) {
        return true;
      }

      return !isUrlMatchingNoProxy(url, proxyController.NO_PROXY);
    };
  };

  const getUrlProxy = (getProxy) => {
    return () => {
      const proxy = getProxy();
      if (!proxy) {
        throw new UnexpectedStateError('HTTP(S) proxy must be configured.');
      }

      return parseProxyUrl(proxy);
    };
  };

  const eventEmitter = new EventEmitter();

  const getHttpProxy = () => {
    return proxyController.HTTP_PROXY;
  };

  const BoundHttpProxyAgent = class extends HttpProxyAgent {
    constructor () {
      super(
        isProxyConfigured(getHttpProxy),
        mustUrlUseProxy(getHttpProxy),
        getUrlProxy(getHttpProxy),
        http.globalAgent,
        eventEmitter
      );
    }
  };

  const httpAgent = new BoundHttpProxyAgent();

  const getHttpsProxy = () => {
    return proxyController.HTTPS_PROXY || proxyController.HTTP_PROXY;
  };

  const BoundHttpsProxyAgent = class extends HttpsProxyAgent {
    constructor () {
      super(
        isProxyConfigured(getHttpsProxy),
        mustUrlUseProxy(getHttpsProxy),
        getUrlProxy(getHttpsProxy),
        https.globalAgent,
        eventEmitter
      );
    }
  };

  const httpsAgent = new BoundHttpsProxyAgent();

  // Overriding globalAgent was added in v11.7.
  // @see https://nodejs.org/uk/blog/release/v11.7.0/
  if (semver.gte(process.version, 'v11.7.0')) {
    // @see https://github.com/facebook/flow/issues/7670
    // $FlowFixMe
    http.globalAgent = httpAgent;

    // $FlowFixMe
    https.globalAgent = httpsAgent;
  } else if (semver.gte(process.version, 'v10.0.0')) {
    // $FlowFixMe
    http.get = bindHttpMethod(httpGet, httpAgent);

    // $FlowFixMe
    http.request = bindHttpMethod(httpRequest, httpAgent);

    // $FlowFixMe
    https.get = bindHttpMethod(httpsGet, httpsAgent);

    // $FlowFixMe
    https.request = bindHttpMethod(httpsRequest, httpsAgent);
  } else {
    log.warn('attempt to initialize global-agent in unsupported Node.js version was ignored');
  }

  return proxyController;
};
