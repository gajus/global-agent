import type * as http from 'http';
import type * as https from 'https';
import {
  serializeError,
} from 'serialize-error';
import Logger from '../Logger';
import type {
  AgentType,
  ConnectionCallbackType,
  ConnectionConfigurationType,
  GetUrlProxyMethodType,
  IsProxyConfiguredMethodType,
  MustUrlUseProxyMethodType,
  ProtocolType,
} from '../types';

const log = Logger.child({
  namespace: 'Agent',
});

let requestId = 0;

type AgentRequestOptions = {
  host?: string,
  path?: string,
  port: number,
};

type HttpRequestOptions = AgentRequestOptions & Omit<http.RequestOptions, keyof AgentRequestOptions> & {
  secureEndpoint: false,
};

type HttpsRequestOptions = AgentRequestOptions & Omit<https.RequestOptions, keyof AgentRequestOptions> & {
  secureEndpoint: true,
};

type RequestOptions = HttpRequestOptions | HttpsRequestOptions;

abstract class Agent {
  public defaultPort: number;

  public protocol: ProtocolType;

  public fallbackAgent: AgentType;

  public isProxyConfigured: IsProxyConfiguredMethodType;

  public mustUrlUseProxy: MustUrlUseProxyMethodType;

  public getUrlProxy: GetUrlProxyMethodType;

  public socketConnectionTimeout: number;

  // ca property is an array of ca certificates
  public ca: string[];

  public constructor (
    isProxyConfigured: IsProxyConfiguredMethodType,
    mustUrlUseProxy: MustUrlUseProxyMethodType,
    getUrlProxy: GetUrlProxyMethodType,
    fallbackAgent: AgentType,
    socketConnectionTimeout: number,
    ca: string[],
  ) {
    this.fallbackAgent = fallbackAgent;
    this.isProxyConfigured = isProxyConfigured;
    this.mustUrlUseProxy = mustUrlUseProxy;
    this.getUrlProxy = getUrlProxy;
    this.socketConnectionTimeout = socketConnectionTimeout;
    this.ca = ca;
  }

  /**
   * This method can be used to add an array of ca certificates
   * @param {string[]} ca an array of ca certificates
   */
  public addCACertificates (ca: string[]) {
    // concat valid ca certificates with the existing certificates,
    if (ca) {
      this.ca = this.ca.concat(ca);
    }
  }

  /**
   * Clears existing CA Certificates
   */
  public clearCACertificates () {
    this.ca = [];
  }

  /**
   * Evaluate value for tls reject unauthorized variable
   */
  public getRejectUnauthorized () {
    // eslint-disable-next-line node/no-process-env
    const rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

    return typeof rejectUnauthorized === 'undefined' ? true : boolean(rejectUnauthorized) !== false;
  }

  public abstract createConnection (configuration: ConnectionConfigurationType, callback: ConnectionCallbackType): void;

  public addRequest (request: http.ClientRequest, configuration: RequestOptions) {
    let requestUrl;

    // It is possible that addRequest was constructed for a proxied request already, e.g.
    // "request" package does this when it detects that a proxy should be used
    // https://github.com/request/request/blob/212570b6971a732b8dd9f3c73354bcdda158a737/request.js#L402
    // https://gist.github.com/gajus/e2074cd3b747864ffeaabbd530d30218
    if (request.path.startsWith('http://') ?? request.path.startsWith('https://')) {
      requestUrl = request.path;
    } else {
      requestUrl = this.protocol + '//' + (configuration.hostname ?? configuration.host) + (configuration.port === 80 ?? configuration.port === 443 ? '' : ':' + configuration.port) + request.path;
    }

    if (!this.isProxyConfigured()) {
      log.trace({
        destination: requestUrl,
      }, 'not proxying request; GLOBAL_AGENT.HTTP_PROXY is not configured');

      // @ts-expect-error seems like we are using wrong type for fallbackAgent.
      this.fallbackAgent.addRequest(request, configuration);

      return;
    }

    if (!this.mustUrlUseProxy(requestUrl)) {
      log.trace({
        destination: requestUrl,
      }, 'not proxying request; url matches GLOBAL_AGENT.NO_PROXY');

      // @ts-expect-error seems like we are using wrong type for fallbackAgent.
      this.fallbackAgent.addRequest(request, configuration);

      return;
    }

    const currentRequestId = requestId++;

    const proxy = this.getUrlProxy(requestUrl);

    if (this.protocol === 'http:') {
      request.path = requestUrl;

      if (proxy.authorization) {
        request.setHeader('proxy-authorization', 'Basic ' + Buffer.from(proxy.authorization).toString('base64'));
      }
    }

    log.trace({
      destination: requestUrl,
      proxy: 'http://' + proxy.hostname + ':' + proxy.port,
      requestId: currentRequestId,
    }, 'proxying request');

    request.on('error', (error: Error) => {
      log.error({
        error: serializeError(error),
      }, 'request error');
    });

    request.once('response', (response: http.IncomingMessage) => {
      log.trace({
        headers: response.headers,
        requestId: currentRequestId,
        statusCode: response.statusCode,
      }, 'proxying response');
    });

    request.shouldKeepAlive = false;

    const connectionConfiguration = {
      host: configuration.hostname ?? configuration.host ?? '',
      port: configuration.port ?? 80,
      proxy,
      tls: {},
    };

    // add optional tls options for https requests.
    // @see https://nodejs.org/docs/latest-v12.x/api/https.html#https_https_request_url_options_callback :
    // > The following additional options from tls.connect()
    // >   - https://nodejs.org/docs/latest-v12.x/api/tls.html#tls_tls_connect_options_callback -
    // > are also accepted:
    // >   ca, cert, ciphers, clientCertEngine, crl, dhparam, ecdhCurve, honorCipherOrder,
    // >   key, passphrase, pfx, rejectUnauthorized, secureOptions, secureProtocol, servername, sessionIdContext.
    if (configuration.secureEndpoint) {
      connectionConfiguration.tls = {
        ca: configuration.ca ?? this.ca,
        cert: configuration.cert,
        ciphers: configuration.ciphers,
        clientCertEngine: configuration.clientCertEngine,
        crl: configuration.crl,
        dhparam: configuration.dhparam,
        ecdhCurve: configuration.ecdhCurve,
        honorCipherOrder: configuration.honorCipherOrder,
        key: configuration.key,
        passphrase: configuration.passphrase,
        pfx: configuration.pfx,
        rejectUnauthorized: configuration.rejectUnauthorized ?? this.getRejectUnauthorized(),
        secureOptions: configuration.secureOptions,
        secureProtocol: configuration.secureProtocol,
        servername: configuration.servername ?? connectionConfiguration.host,
        sessionIdContext: configuration.sessionIdContext,
      };
    }

    this.createConnection(connectionConfiguration, (error, socket) => {
      log.trace({
        target: connectionConfiguration,
      }, 'connecting');

      // @see https://github.com/nodejs/node/issues/5757#issuecomment-305969057
      if (socket) {
        socket.setTimeout(this.socketConnectionTimeout, () => {
          socket.destroy();
        });

        socket.once('connect', () => {
          log.trace({
            target: connectionConfiguration,
          }, 'connected');

          socket.setTimeout(0);
        });

        socket.once('secureConnect', () => {
          log.trace({
            target: connectionConfiguration,
          }, 'connected (secure)');

          socket.setTimeout(0);
        });
      }

      if (error) {
        request.emit('error', error);
      } else if (socket) {
        log.debug('created socket');

        socket.on('error', (socketError: Error) => {
          log.error({
            error: serializeError(socketError),
          }, 'socket error');
        });

        request.onSocket(socket);
      }
    });
  }
}

export default Agent;
