import net from 'net';
import type {
  AgentType,
  ConnectionCallbackType,
  ConnectionConfigurationType,
  GetUrlProxyMethodType,
  IsProxyConfiguredMethodType,
  MustUrlUseProxyMethodType,
} from '../types';
import Agent from './Agent';

class HttpProxyAgent extends Agent {
  // @see https://github.com/sindresorhus/eslint-plugin-unicorn/issues/169#issuecomment-486980290
  public constructor (
    isProxyConfigured: IsProxyConfiguredMethodType,
    mustUrlUseProxy: MustUrlUseProxyMethodType,
    getUrlProxy: GetUrlProxyMethodType,
    fallbackAgent: AgentType,
    socketConnectionTimeout: number,
    ca: string[] | string | undefined,
  ) {
    super(
      isProxyConfigured,
      mustUrlUseProxy,
      getUrlProxy,
      fallbackAgent,
      socketConnectionTimeout,
      ca,
    );

    this.protocol = 'http:';
    this.defaultPort = 80;
  }

  public createConnection (configuration: ConnectionConfigurationType, callback: ConnectionCallbackType) {
    const socket = net.connect(
      configuration.proxy.port,
      configuration.proxy.hostname,
    );

    callback(null, socket);
  }
}

export default HttpProxyAgent;
