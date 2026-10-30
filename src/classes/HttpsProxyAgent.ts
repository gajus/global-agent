import http from 'http';
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

    // Agent only times out the socket passed to the callback, which does not exist until the proxy has answered. 0 disables it, as in Agent.
    // setTimeout() turns delays above 2^31 - 1 ms into 1 ms, where socket.setTimeout() in Agent caps them.
    // The error codes are those Node.js uses for the same failures, which HTTP clients retry on.
    const connectTimeout = this.socketConnectionTimeout > 0 ? setTimeout(() => {
      socket.destroy(Object.assign(new Error(`Proxy server did not establish the tunnel to '${configuration.host}:${configuration.port}' in time`), {
        code: 'ETIMEDOUT',
      }));
    }, Math.min(this.socketConnectionTimeout, 2_147_483_647)) : undefined;

    socket.once('close', () => {
      clearTimeout(connectTimeout);
    });

    const onEnd = () => {
      socket.destroy(Object.assign(new Error(`Proxy server closed the connection before answering CONNECT to '${configuration.host}:${configuration.port}'`), {
        code: 'ECONNRESET',
      }));
    };

    let response = '';
    let responseSize = 0;

    const onData = (data: Buffer) => {
      // Proxies with HTTPS as protocal are not allowed by parseProxyUrl(), so it should be safe to assume that the response is plain text
      response += data.toString();
      responseSize += data.length;

      // The response may arrive in several chunks; TLS must not start before the end of its headers.
      if (!/\r?\n\r?\n/.test(response)) {
        if (responseSize > http.maxHeaderSize) {
          socket.destroy(new Error(`Proxy server answered CONNECT to '${configuration.host}:${configuration.port}' with headers larger than ${http.maxHeaderSize} bytes`));
        }

        return;
      }

      socket.off('data', onData);
      socket.off('end', onEnd);
      clearTimeout(connectTimeout);

      const statusLine = response.split(/\r?\n/)[0];
      const statusLineExp = /^HTTP\/(\d)\.(\d) (\d{3}) ?(.*)$/;

      const statusCode = statusLineExp.exec(statusLine)?.[3];

      if (typeof statusCode === 'string' && Number(statusCode) >= 400) {
        const error = new Error(`Proxy server refused connecting to '${configuration.host}:${configuration.port}' (${statusLine})`);
        socket.destroy();
        callback(error);

        return;
      }

      // Bytes after the headers are dropped: a 2xx CONNECT response has no body and the TLS client speaks first.
      const secureSocket = tls.connect({
        ...configuration.tls,
        // Used to verify the server identity when servername is omitted (e.g. IP address).
        host: configuration.host,
        socket,
      });

      callback(null, secureSocket);
    };

    socket.on('data', onData);
    socket.once('end', onEnd);

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
