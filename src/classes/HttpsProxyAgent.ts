import net from 'net';
import tls from 'tls';
import type {
  AgentType,
  ConnectionCallbackType,
  ConnectionConfigurationType,
  GetUrlProxyMethodType,
  IsProxyConfiguredMethodType,
  MustUrlUseProxyMethodType,
} from '../types';
import Agent from './Agent';

class HttpsProxyAgent extends Agent {
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

    this.protocol = 'https:';
    this.defaultPort = 443;
  }

  public createConnection (configuration: ConnectionConfigurationType, callback: ConnectionCallbackType) {
    const socket = net.connect(
      configuration.proxy.port,
      configuration.proxy.hostname,
    );

    socket.on('error', (error) => {
      callback(error);
    });

    socket.once('data', (data) => {
      // Proxies with HTTPS as protocal are not allowed by parseProxyUrl(), so it should be safe to assume that the response is plain text
      const statusLine = data.toString().split('\r\n')[0];
      const statusLineExp = /^HTTP\/(\d)\.(\d) (\d{3}) ?(.*)$/;

      const statusCode = statusLineExp.exec(statusLine)?.[3];

      if (typeof statusCode === 'string' && Number(statusCode) >= 400) {
        const error = new Error(`Proxy server refused connecting to '${configuration.host}:${configuration.port}' (${statusLine})`);
        socket.destroy();
        callback(error);

        return;
      }

      const secureSocket = tls.connect({
        ...configuration.tls,
        socket,
      });

      callback(null, secureSocket);
    });

    let connectMessage = '';

    connectMessage += 'CONNECT ' + configuration.host + ':' + configuration.port + ' HTTP/1.1\r\n';
    connectMessage += 'Host: ' + configuration.host + ':' + configuration.port + '\r\n';

    if (configuration.proxy.authorization) {
      connectMessage += 'Proxy-Authorization: Basic ' + Buffer.from(configuration.proxy.authorization).toString('base64') + '\r\n';
    }

    connectMessage += '\r\n';

    socket.write(connectMessage);
  }
}

export default HttpsProxyAgent;
