// @flow

import net from 'net';
import tls from 'tls';
import type {
  ConnectionCallbackType,
  ConnectionConfigurationType
} from '../types';
import Agent from './Agent';

class HttpsProxyAgent extends Agent {
  createConnection (configuration: ConnectionConfigurationType, callback: ConnectionCallbackType) {
    const socket = net.connect(
      configuration.proxy.port,
      configuration.proxy.hostname
    );

    socket.once('data', () => {
      const secureSocket = tls.connect({
        rejectUnauthorized: false,
        servername: configuration.host,
        socket
      });

      callback(null, secureSocket);
    });

    socket.write('CONNECT ' + configuration.host + ':' + configuration.port + ' HTTP/1.1\r\nHost: ' + configuration.host + ':' + configuration.port + '\r\n\r\n');
  }
}

export default HttpsProxyAgent;
