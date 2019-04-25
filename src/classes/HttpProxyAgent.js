// @flow

import net from 'net';
import type {
  ConnectionCallbackType,
  ConnectionConfigurationType
} from '../types';
import Agent from './Agent';

class HttpProxyAgent extends Agent {
  createConnection (configuration: ConnectionConfigurationType, callback: ConnectionCallbackType) {
    const socket = net.connect(
      configuration.proxy.port,
      configuration.proxy.hostname
    );

    callback(null, socket);
  }
}

export default HttpProxyAgent;
