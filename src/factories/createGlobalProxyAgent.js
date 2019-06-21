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

  const httpAgent = new HttpProxyAgent(
    isProxyConfigured(getHttpProxy),
    mustUrlUseProxy(getHttpProxy),
    getUrlProxy(getHttpProxy),
    http.globalAgent,
    eventEmitter
  );

  const getHttpsProxy = () => {
    return proxyController.HTTPS_PROXY || proxyController.HTTP_PROXY;
  };

  const httpsAgent = new HttpsProxyAgent(
    isProxyConfigured(getHttpsProxy),
    mustUrlUseProxy(getHttpsProxy),
    getUrlProxy(getHttpsProxy),
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
  } else if (semver.gte(process.version, 'v10')) {
    // $FlowFixMe
    http.get = bindHttpMethod(http.get, httpAgent);

    // $FlowFixMe
    http.request = bindHttpMethod(http.request, httpAgent);

    // $FlowFixMe
    https.get = bindHttpMethod(https.get, httpsAgent);

    // $FlowFixMe
    https.request = bindHttpMethod(https.request, httpsAgent);
  } else {
    log.warn('attempt to initialize global-agent in unsupported Node.js version was ignored');
  }

  return proxyController;
};
