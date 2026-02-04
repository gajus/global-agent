import http from 'http';
import https from 'https';
import semverGte from 'semver/functions/gte';
import {
  logger,
  setLogger,
} from '../Logger';
import {
  HttpProxyAgent,
  HttpsProxyAgent,
} from '../classes';
import {
  UnexpectedStateError,
} from '../errors';
import type {
  ProxyAgentConfigurationInputType,
  ProxyAgentConfigurationType,
} from '../types';
import {
  bindHttpMethod,
  isUrlMatchingNoProxy,
  parseProxyUrl,
} from '../utilities';
import {
  parseBoolean,
} from '../utilities/parseBoolean';
import createProxyController from './createProxyController';

const httpGet = http.get;
const httpRequest = http.request;
const httpsGet = https.get;
const httpsRequest = https.request;

const log = logger.child({
  namespace: 'createGlobalProxyAgent',
});

const defaultConfigurationInput = {
  environmentVariableNamespace: undefined,
  forceGlobalAgent: undefined,
  socketConnectionTimeout: 60_000,
};

const createConfiguration = (configurationInput: ProxyAgentConfigurationInputType): ProxyAgentConfigurationType => {
  // oxlint-disable-next-line node/no-process-env
  const environment = process.env;

  const defaultConfiguration = {
    environmentVariableNamespace: typeof environment.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE === 'string' ? environment.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE : 'GLOBAL_AGENT_',
    forceGlobalAgent: typeof environment.GLOBAL_AGENT_FORCE_GLOBAL_AGENT === 'string' ? parseBoolean(environment.GLOBAL_AGENT_FORCE_GLOBAL_AGENT) : true,
    socketConnectionTimeout: typeof environment.GLOBAL_AGENT_SOCKET_CONNECTION_TIMEOUT === 'string' ? Number.parseInt(environment.GLOBAL_AGENT_SOCKET_CONNECTION_TIMEOUT, 10) : defaultConfigurationInput.socketConnectionTimeout,
  };

  return {
    ...defaultConfiguration,
    ...Object.fromEntries(Object.entries(configurationInput).filter(([, v]) => v !== undefined)),
  };
};

export default (configurationInput: ProxyAgentConfigurationInputType = defaultConfigurationInput) => {
  const configuration = createConfiguration(configurationInput);

  if (configurationInput.logger) {
    setLogger(configurationInput.logger);
  }

  const proxyController = createProxyController();

  // oxlint-disable-next-line node/no-process-env
  proxyController.HTTP_PROXY = process.env[configuration.environmentVariableNamespace + 'HTTP_PROXY'] ?? null;

  // oxlint-disable-next-line node/no-process-env
  proxyController.HTTPS_PROXY = process.env[configuration.environmentVariableNamespace + 'HTTPS_PROXY'] ?? null;

  // oxlint-disable-next-line node/no-process-env
  proxyController.NO_PROXY = process.env[configuration.environmentVariableNamespace + 'NO_PROXY'] ?? null;

  log.info({
    configuration,
    state: proxyController,
  }, 'global agent has been initialized');

  const mustUrlUseProxy = (getProxy: () => string | null) => {
    return (url: string): boolean => {
      if (!getProxy()) {
        return false;
      }

      if (!proxyController.NO_PROXY) {
        return true;
      }

      return !isUrlMatchingNoProxy(url, proxyController.NO_PROXY);
    };
  };

  const getUrlProxy = (getProxy: () => string | null) => {
    return () => {
      const proxy = getProxy();

      if (!proxy) {
        throw new UnexpectedStateError('HTTP(S) proxy must be configured.');
      }

      return parseProxyUrl(proxy);
    };
  };

  const getHttpProxy = () => {
    return proxyController.HTTP_PROXY;
  };

  const BoundHttpProxyAgent = class extends HttpProxyAgent {
    public constructor () {
      super(
        () => {
          return Boolean(getHttpProxy());
        },
        mustUrlUseProxy(getHttpProxy),
        getUrlProxy(getHttpProxy),
        http.globalAgent,
        configuration.socketConnectionTimeout,
        configuration.ca,
      );
    }
  };

  const httpAgent = new BoundHttpProxyAgent();

  const getHttpsProxy = () => {
    return proxyController.HTTPS_PROXY ?? proxyController.HTTP_PROXY;
  };

  const BoundHttpsProxyAgent = class extends HttpsProxyAgent {
    public constructor () {
      super(
        () => {
          return Boolean(getHttpsProxy());
        },
        mustUrlUseProxy(getHttpsProxy),
        getUrlProxy(getHttpsProxy),
        https.globalAgent,
        configuration.socketConnectionTimeout,
        configuration.ca,
      );
    }
  };

  const httpsAgent = new BoundHttpsProxyAgent();

  // Overriding globalAgent was added in v11.7.
  // @see https://nodejs.org/uk/blog/release/v11.7.0/
  if (semverGte(process.version, 'v11.7.0')) {
    // @see https://github.com/facebook/flow/issues/7670
    // @ts-expect-error Node.js version compatibility
    http.globalAgent = httpAgent;

    // @ts-expect-error Node.js version compatibility
    https.globalAgent = httpsAgent;
  }

  // The reason this logic is used in addition to overriding http(s).globalAgent
  // is because there is no guarantee that we set http(s).globalAgent variable
  // before an instance of http(s).Agent has been already constructed by someone,
  // e.g. Stripe SDK creates instances of http(s).Agent at the top-level.
  // @see https://github.com/gajus/global-agent/pull/13
  //
  // We still want to override http(s).globalAgent when possible to enable logic
  // in `bindHttpMethod`.
  if (semverGte(process.version, 'v10.0.0')) {
    // @ts-expect-error seems like we are using wrong type for httpAgent
    http.get = bindHttpMethod(httpGet, httpAgent, configuration.forceGlobalAgent);

    // @ts-expect-error seems like we are using wrong type for httpAgent
    http.request = bindHttpMethod(httpRequest, httpAgent, configuration.forceGlobalAgent);

    // @ts-expect-error seems like we are using wrong type for httpAgent
    https.get = bindHttpMethod(httpsGet, httpsAgent, configuration.forceGlobalAgent);

    // @ts-expect-error seems like we are using wrong type for httpAgent
    https.request = bindHttpMethod(httpsRequest, httpsAgent, configuration.forceGlobalAgent);
  } else {
    log.warn('attempt to initialize global-agent in unsupported Node.js version was ignored');
  }

  return proxyController;
};
