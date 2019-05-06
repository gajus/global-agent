// @flow

import EventEmitter from 'events';
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

let requestId = 0;

class Agent {
  defaultPort: number;

  protocol: ProtocolType;

  fallbackAgent: AgentType;

  mustUrlUseProxy: MustUrlUseProxyMethodType;

  getUrlProxy: GetUrlProxyMethodType;

  eventEmitter: EventEmitter;

  constructor (
    mustUrlUseProxy: MustUrlUseProxyMethodType,
    getUrlProxy: GetUrlProxyMethodType,
    fallbackAgent: AgentType,
    eventEmitter: EventEmitter
  ) {
    this.fallbackAgent = fallbackAgent;
    this.mustUrlUseProxy = mustUrlUseProxy;
    this.getUrlProxy = getUrlProxy;
    this.eventEmitter = eventEmitter;
  }

  addRequest (request: *, configuration: *) {
    const requestUrl = this.protocol + '//' + configuration.hostname + (configuration.port === 80 || configuration.port === 443 ? '' : ':' + configuration.port) + request.path;

    if (this.mustUrlUseProxy(requestUrl)) {
      const currentRequestId = requestId++;

      const proxy = this.getUrlProxy(requestUrl);

      if (this.protocol === 'http:') {
        request.path = requestUrl;

        if (proxy.authorization) {
          request.setHeader('Proxy-Authorization', 'Basic ' + Buffer.from(proxy.authorization).toString('base64'));
        }
      }

      this.eventEmitter.emit('request', request);

      log.trace({
        destination: requestUrl,
        proxy: 'http://' + proxy.hostname + ':' + proxy.port,
        requestId: currentRequestId
      }, 'proxying request');

      request.once('response', (response) => {
        log.trace({
          headers: response.headers,
          requestId: currentRequestId,
          statusCode: response.statusCode
        }, 'proxying response');
      });

      request.shouldKeepAlive = false;

      const connectionConfiguration = {
        host: configuration.hostname || configuration.host,
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
