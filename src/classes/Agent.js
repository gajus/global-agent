// @flow

import url from 'url';
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
  protocol: ProtocolType;

  fallbackAgent: AgentType;

  mustUrlUseProxy: MustUrlUseProxyMethodType;

  getUrlProxy: GetUrlProxyMethodType;

  constructor (protocol: ProtocolType, mustUrlUseProxy: MustUrlUseProxyMethodType, getUrlProxy: GetUrlProxyMethodType, fallbackAgent: AgentType) {
    this.protocol = protocol;
    this.fallbackAgent = fallbackAgent;
    this.mustUrlUseProxy = mustUrlUseProxy;
    this.getUrlProxy = getUrlProxy;
  }

  addRequest (request: *, configuration: *) {
    const requestUrl = url.format({
      hostname: configuration.hostname || configuration.host,
      pathname: request.path,
      port: configuration.port === 80 ? undefined : configuration.port,
      protocol: this.protocol
    });

    if (this.mustUrlUseProxy(requestUrl)) {
      const proxy = this.getUrlProxy(requestUrl);

      log.trace('proxying request to %s', requestUrl);

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
      // $FlowFixMe It appears that Flow is missing the method description.
      this.fallbackAgent.addRequest(request, configuration);
    }
  }
}

export default Agent;
