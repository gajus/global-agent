// @flow

import Logger from '../Logger';
import type {
  AgentType,
  GetUrlProxyMethodType,
  MustUrlUseProxyMethodType,
  ProtocolType
} from '../types';

const log = Logger.child({
  namespace: 'Agent'
});

class Agent {
  defaultPort: number;

  protocol: ProtocolType;

  fallbackAgent: AgentType;

  mustUrlUseProxy: MustUrlUseProxyMethodType;

  getUrlProxy: GetUrlProxyMethodType;

  constructor (mustUrlUseProxy: MustUrlUseProxyMethodType, getUrlProxy: GetUrlProxyMethodType, fallbackAgent: AgentType) {
    this.fallbackAgent = fallbackAgent;
    this.mustUrlUseProxy = mustUrlUseProxy;
    this.getUrlProxy = getUrlProxy;
  }

  addRequest (request: *, configuration: *) {
    const requestUrl = this.protocol + '//' + configuration.hostname + (configuration.port === 80 || configuration.port === 443 ? '' : ':' + configuration.port) + request.path;

    if (this.mustUrlUseProxy(requestUrl)) {
      if (this.protocol === 'http:') {
        request.path = requestUrl;
      }

      const proxy = this.getUrlProxy(requestUrl);

      log.trace({
        destination: requestUrl,
        proxy: 'http://' + proxy.hostname + ':' + proxy.port
      }, 'proxying request');

      request.shouldKeepAlive = false;

      const connectionConfiguration = {
        host: configuration.hostname,
        port: configuration.port || 80,
        proxy
      };

      // $FlowFixMe It appears that Flow is missing the method description.
      this.createConnection(connectionConfiguration, (error, socket) => {
        if (error) {
          request.emit('error', error);
        } else {
          request.onSocket(socket);
        }
      });
    } else {
      log.trace({
        destination: requestUrl
      }, 'not proxying request; request URL matches NO_PROXY');

      // $FlowFixMe It appears that Flow is missing the method description.
      this.fallbackAgent.addRequest(request, configuration);
    }
  }
}

export default Agent;
