import type {
  IncomingMessage,
  IncomingHttpHeaders,
} from 'http';
import http from 'http';
import https from 'https';
import net from 'net';
import {
  serial,
  before,
  afterEach,
  beforeEach,
} from 'ava';
import axios from 'axios';
import getPort from 'get-port';
import got from 'got';
import pem from 'pem';
import makeRequest from 'request';
import {
  stub,
} from 'sinon';
import createGlobalProxyAgent from '../../../src/factories/createGlobalProxyAgent';

type ProxyServerType = {
  port: number,
  stop: () => void,
  url: string,
};

type HttpServerType = {
  stop: () => void,
  url: string,
};

type HttpsServerType = {
  port: number,
  stop: () => void,
  url: string,
};

type ProxyRules = {
  beforeSendRequest?: (requestDetail: {
    requestOptions: {
      headers: Record<string, string>,
    },
  }) => {
    response: {
      body: string,
      header: Record<string, string>,
      statusCode: number,
    },
  },
  onConnect?: (request: http.IncomingMessage) => void,
};

const defaultHttpAgent = http.globalAgent;
const defaultHttpsAgent = https.globalAgent;

// Backup original value of NODE_TLS_REJECT_UNAUTHORIZED
// oxlint-disable-next-line node/no-process-env
const defaultNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

let lastPort = 3_000;

let localProxyServers: ProxyServerType[] = [];
let localHttpServers: HttpServerType[] = [];
let localHttpsServers: HttpsServerType[] = [];
let generatedCerts: {
  cert: string,
  key: string,
} | null = null;

const getNextPort = (): Promise<number> => {
  return getPort({
    port: getPort.makeRange(lastPort++, 3_500),
  });
};

// Generate self-signed certificates for HTTPS testing
const generateCertificates = (): Promise<{
  cert: string,
  key: string,
}> => {
  return new Promise((resolve, reject) => {
    if (generatedCerts) {
      resolve(generatedCerts);

      return;
    }

    pem.createCertificate({days: 1, selfSigned: true}, (error, keys) => {
      if (error) {
        reject(error);

        return;
      }

      generatedCerts = {cert: keys.certificate, key: keys.serviceKey};
      resolve(generatedCerts);
    });
  });
};

before(async () => {
  // Pre-generate certificates
  await generateCertificates();
});

beforeEach(() => {
  http.globalAgent = defaultHttpAgent;
  https.globalAgent = defaultHttpsAgent;
});

afterEach(() => {
  for (const localProxyServer of localProxyServers) {
    localProxyServer.stop();
  }

  localProxyServers = [];

  for (const localHttpServer of localHttpServers) {
    localHttpServer.stop();
  }

  localHttpServers = [];

  for (const localHttpsServer of localHttpsServers) {
    localHttpsServer.stop();
  }

  localHttpsServers = [];

  // Reset NODE_TLS_REJECT_UNAUTHORIZED to original value
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = defaultNodeTlsRejectUnauthorized;
});

type HttpResponseType = {
  body: string,
  headers: IncomingHttpHeaders,
  statusCode: number,
};

const createHttpResponseResolver = (resolve: (response: HttpResponseType) => void) => {
  return (response: IncomingMessage) => {
    let body = '';

    response.on('data', (data) => {
      body += data;
    });

    response.on('end', () => {
      if (!response.headers) {
        throw new Error('response.headers is not defined');
      }

      if (!response.statusCode) {
        throw new Error('response.statusCode is not defined');
      }

      resolve({
        body,
        headers: response.headers,
        statusCode: response.statusCode,
      });
    });
  };
};

// Create a local HTTPS server for CONNECT tunnel targets
const createHttpsServer = async (): Promise<HttpsServerType> => {
  const port = await getNextPort();
  const certs = await generateCertificates();

  const localHttpsServer: HttpsServerType = await new Promise((resolve) => {
    const httpsServer = https.createServer({
      cert: certs.cert,
      key: certs.key,
    }, (request, response) => {
      response.writeHead(200, {'content-type': 'text/plain'});
      response.end('OK');
    });

    httpsServer.listen(port, '127.0.0.1', () => {
      resolve({
        port,
        stop: () => {
          httpsServer.close();
        },
        url: 'https://127.0.0.1:' + port,
      });
    });
  });

  localHttpsServers.push(localHttpsServer);

  return localHttpsServer;
};

// Create a simple HTTP proxy server that can handle both HTTP requests and HTTPS CONNECT tunneling
const createProxyServer = async (rules?: ProxyRules): Promise<ProxyServerType & {
  httpsServer?: HttpsServerType,
}> => {
  const port = await getNextPort();

  // Create an HTTPS server that the proxy will tunnel to for CONNECT requests
  const httpsServer = await createHttpsServer();

  const localProxyServer: ProxyServerType & {
    httpsServer?: HttpsServerType,
  } = await new Promise((resolve) => {
    const proxyServer = http.createServer((request, response) => {
      // Handle regular HTTP proxy requests
      if (rules?.beforeSendRequest) {
        const result = rules.beforeSendRequest({
          requestOptions: {
            headers: request.headers as Record<string, string>,
          },
        });

        response.writeHead(result.response.statusCode, result.response.header);
        response.end(result.response.body);
      } else {
        // Default response
        response.writeHead(200, {'content-type': 'text/plain'});
        response.end('OK');
      }
    });

    // Handle CONNECT requests for HTTPS tunneling
    proxyServer.on('connect', (request, clientSocket, head) => {
      // Call onConnect hook if provided
      if (rules?.onConnect) {
        rules.onConnect(request);
      }

      // Connect to the local HTTPS server instead of the requested host
      const serverSocket = net.connect(httpsServer.port, '127.0.0.1', () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      serverSocket.on('error', () => {
        clientSocket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      });

      clientSocket.on('error', () => {
        serverSocket.end();
      });
    });

    proxyServer.listen(port, () => {
      resolve({
        httpsServer,
        port,
        stop: () => {
          proxyServer.close();
        },
        url: 'http://127.0.0.1:' + port,
      });
    });
  });

  localProxyServers.push(localProxyServer);

  return localProxyServer;
};

const createHttpServer = async (): Promise<HttpServerType> => {
  const port = await getNextPort();

  const localHttpServer: HttpServerType = await new Promise((resolve) => {
    const httpServer = http.createServer((request, response) => {
      response.end('DIRECT');
    });

    httpServer.listen(port, () => {
      resolve({
        stop: () => {
          httpServer.close();
        },
        url: 'http://127.0.0.1:' + port,
      });
    });
  });

  localHttpServers.push(localHttpServer);

  return localHttpServer;
};

serial('proxies HTTP request', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response: HttpResponseType = await new Promise((resolve) => {
    http.get('http://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');
});

serial('proxies HTTP request with proxy-authorization header', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const beforeSendRequest = stub().callsFake(() => {
    return {
      response: {
        body: 'OK',
        header: {'content-type': 'text/plain'},
        statusCode: 200,
      },
    };
  });

  const proxyServer = await createProxyServer({
    beforeSendRequest,
  });

  globalProxyAgent.HTTP_PROXY = 'http://foo@127.0.0.1:' + proxyServer.port;

  const response: HttpResponseType = await new Promise((resolve) => {
    http.get('http://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');

  t.is(beforeSendRequest.firstCall.args[0].requestOptions.headers['proxy-authorization'], 'Basic Zm9v');
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = undefined', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  const {NODE_TLS_REJECT_UNAUTHORIZED, ...restEnvironments} = process.env; // oxlint-disable-line @typescript-eslint/no-unused-vars
  // oxlint-disable-next-line node/no-process-env
  process.env = restEnvironments;
  // oxlint-disable-next-line node/no-process-env
  process.env.GLOBAL_AGENT_FORCE_GLOBAL_AGENT = 'true';
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), true);

  const response: HttpResponseType = await new Promise((resolve) => {
    http.get('http://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = null', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 'null';
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), false);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = 1', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with int
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), true);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = 0', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with int
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), false);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = true', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with boolean
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = true;
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), true);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = false', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with boolean
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = false;
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), false);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = yes', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 'yes';
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), true);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = no', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 'no';
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), false);
});

serial('Test addCACertificates and clearCACertificates methods', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca, undefined);
  globalAgent.addCACertificates(['test-ca-certficate1', 'test-ca-certficate2']);
  globalAgent.addCACertificates(['test-ca-certficate3']);
  const result = ['test-ca-certficate1', 'test-ca-certficate2', 'test-ca-certficate3'];
  t.is(globalAgent.ca.length, result.length);
  t.is(JSON.stringify(globalAgent.ca), JSON.stringify(result));
  globalAgent.clearCACertificates();
  t.is(globalAgent.ca, undefined);
});

serial('Test addCACertificates when passed ca is a string', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca, undefined);
  globalAgent.addCACertificates('test-ca-certficate1');
  globalAgent.addCACertificates('test-ca-certficate2');
  t.is(globalAgent.ca, 'test-ca-certficate1test-ca-certficate2');
  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('Test addCACertificates when input ca is a string and existing ca is array', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent({ca: ['test-ca']});

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca.length, 1);
  globalAgent.addCACertificates('test-ca-certficate1');
  t.is(globalAgent.ca.length, 1);
  t.is(JSON.stringify(globalAgent.ca), JSON.stringify(['test-ca']));
  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('Test addCACertificates when input ca array is null or undefined', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca, undefined);
  globalAgent.addCACertificates(undefined);
  globalAgent.addCACertificates(null);
  t.is(globalAgent.ca, undefined);
  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('Test initializing ca certificate property while creating global proxy agent', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent({ca: ['test-ca']});

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca.length, 1);
  globalAgent.addCACertificates(['test-ca1']);
  t.is(globalAgent.ca.length, 2);
  t.is(globalAgent.ca[0], 'test-ca');
  t.is(globalAgent.ca[1], 'test-ca1');
  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('proxies HTTPS request', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');
});

serial('proxies HTTPS request with proxy-authorization header', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const onConnect = stub();

  const proxyServer = await createProxyServer({
    onConnect,
  });

  globalProxyAgent.HTTP_PROXY = 'http://foo@127.0.0.1:' + proxyServer.port;

  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');

  t.is(onConnect.firstCall.args[0].headers['proxy-authorization'], 'Basic Zm9v');
});

serial('does not produce unhandled rejection when cannot connect to proxy', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const port = await getNextPort();

  globalProxyAgent.HTTP_PROXY = 'http://127.0.0.1:' + port;

  await t.throwsAsync(got('http://127.0.0.1'));
});

serial('proxies HTTPS request with dedicated proxy', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTPS_PROXY = proxyServer.url;

  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');
});

serial('ignores dedicated HTTPS proxy for HTTP urls', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  globalProxyAgent.HTTPS_PROXY = 'http://example.org';

  const response: HttpResponseType = await new Promise((resolve) => {
    http.get('http://127.0.0.1', {}, createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');
});

serial('forwards requests matching NO_PROXY', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();
  const httpServer = await createHttpServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  globalProxyAgent.NO_PROXY = '127.0.0.1';

  const response: HttpResponseType = await new Promise((resolve) => {
    http.get(httpServer.url, createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'DIRECT');
});

serial('forwards requests that go to a socket', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  // not relevant as traffic shouldn't go through proxy
  globalProxyAgent.HTTP_PROXY = 'localhost:10324';

  const server = http.createServer((request, serverResponse) => {
    serverResponse.writeHead(200);
    serverResponse.write('OK');
    serverResponse.end();
  });

  t.teardown(() => {
    server.close();
  });
  server.listen('/tmp/test.sock');

  const response: HttpResponseType = await new Promise((resolve) => {
    http.get({
      path: '/endpoint',
      socketPath: '/tmp/test.sock',
    }, createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('proxies HTTP request (using http.get(host))', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response: HttpResponseType = await new Promise((resolve) => {
    http.get({
      host: '127.0.0.1',
    }, createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');
});

serial('proxies HTTP request (using got)', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response = await got('http://127.0.0.1');

  t.is(response.body, 'OK');
});

serial('proxies HTTPS request (using got)', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response = await got('https://127.0.0.1');

  t.is(response.body, 'OK');
});

serial('proxies HTTP request (using axios)', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response = await axios.get('http://127.0.0.1');

  t.is(response.data, 'OK');
});

serial('proxies HTTPS request (using axios)', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response = await axios.get('https://127.0.0.1');

  t.is(response.data, 'OK');
});

serial('proxies HTTP request (using request)', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response = await new Promise((resolve) => {
    makeRequest('http://127.0.0.1', (error, requestResponse, body) => {
      t.is(error, null);

      resolve(body);
    });
  });

  t.is(response, 'OK');
});

serial('proxies HTTPS request (using request)', async (t) => {
  // oxlint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response = await new Promise((resolve) => {
    makeRequest('https://127.0.0.1', (error, requestResponse, body) => {
      t.is(error, null);

      resolve(body);
    });
  });

  t.is(response, 'OK');
});
