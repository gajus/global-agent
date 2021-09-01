/* eslint-disable ava/use-test */

import type {
  IncomingMessage,
  IncomingHttpHeaders,
} from 'http';
import http from 'http';
import https from 'https';
import AnyProxy, {
  ProxyServer,
} from 'anyproxy';
import {
  serial,
  before,
  afterEach,
  beforeEach,
} from 'ava';
import axios from 'axios';
import getPort from 'get-port';
import got from 'got';
import makeRequest from 'request';
import sinon from 'sinon';
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

const anyproxyDefaultRules = {
  beforeDealHttpsRequest: async () => {
    return true;
  },
  beforeSendRequest: () => {
    return {
      response: {
        body: 'OK',
        header: {
          'content-type': 'text/plain',
        },
        statusCode: 200,
      },
    };
  },
};

const defaultHttpAgent = http.globalAgent;
const defaultHttpsAgent = https.globalAgent;

// Backup original value of NODE_TLS_REJECT_UNAUTHORIZED
// eslint-disable-next-line node/no-process-env
const defaultNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

let lastPort = 3_000;

let localProxyServers: ProxyServerType[] = [];
let localHttpServers: HttpServerType[] = [];

const getNextPort = (): Promise<number> => {
  return getPort({
    port: getPort.makeRange(lastPort++, 3_500),
  });
};

before(() => {
  if (AnyProxy.utils.certMgr.ifRootCAFileExists()) {
    return;
  }

  // @see https://github.com/alibaba/anyproxy/issues/332#issuecomment-486705002
  AnyProxy.utils.certMgr.generateRootCA((error) => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('cannot generate certificate', error);
    }
  });
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

  // Reset NODE_TLS_REJECT_UNAUTHORIZED to original value
  // eslint-disable-next-line node/no-process-env
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

const createProxyServer = async (anyproxyRules?: any): Promise<ProxyServerType> => {
  const port = await getNextPort();

  const localProxyServer: ProxyServerType = await new Promise((resolve) => {
    const proxyServer = new ProxyServer({
      port,
      rule: {
        ...anyproxyRules ? anyproxyRules : anyproxyDefaultRules,
      },
    });

    proxyServer.on('ready', () => {
      resolve({
        port,
        stop: () => {
          proxyServer.close();
        },
        url: 'http://127.0.0.1:' + port,
      });
    });

    proxyServer.start();
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

  const beforeSendRequest = sinon.stub().callsFake(anyproxyDefaultRules.beforeSendRequest);

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
  // eslint-disable-next-line node/no-process-env
  const {NODE_TLS_REJECT_UNAUTHORIZED, ...restEnvironments} = process.env; // eslint-disable-line @typescript-eslint/no-unused-vars
  // eslint-disable-next-line node/no-process-env
  process.env = restEnvironments;
  // eslint-disable-next-line node/no-process-env
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
  // eslint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 'null';
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), false);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = 1', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with int
  // eslint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), true);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = 0', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with int
  // eslint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), false);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = true', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with boolean
  // eslint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = true;
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), true);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = false', async (t) => {
  // @ts-expect-error it is expected as we wanted to set process variable with boolean
  // eslint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = false;
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), false);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = yes', async (t) => {
  // eslint-disable-next-line node/no-process-env
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 'yes';
  const globalProxyAgent = createGlobalProxyAgent();
  const proxyServer = await createProxyServer();
  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.getRejectUnauthorized(), true);
});

serial('Test reject unauthorized variable when NODE_TLS_REJECT_UNAUTHORIZED = no', async (t) => {
  // eslint-disable-next-line node/no-process-env
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
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca, undefined);
  globalAgent.addCACertificates('test-ca-certficate1');
  globalAgent.addCACertificates('test-ca-certficate2');
  t.is(globalAgent.ca, 'test-ca-certficate1test-ca-certficate2');
  const response: HttpResponseType = await new Promise((resolve) => {
    // @ts-expect-error seems 'secureEndpoint' property is not supported by RequestOptions but it should be.
    https.get('https://127.0.0.1', {ca: ['test-ca'], secureEndpoint: true, servername: '127.0.0.1'}, createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('Test addCACertificates when input ca is a string and existing ca is array', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent({ca: ['test-ca']});

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca.length, 1);
  globalAgent.addCACertificates('test-ca-certficate1');
  t.is(globalAgent.ca.length, 1);
  t.is(JSON.stringify(globalAgent.ca), JSON.stringify(['test-ca']));
  const response: HttpResponseType = await new Promise((resolve) => {
    // @ts-expect-error seems 'secureEndpoint' property is not supported by RequestOptions but it should be.
    https.get('https://127.0.0.1', {ca: ['test-ca'], secureEndpoint: true, servername: '127.0.0.1'}, createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('Test addCACertificates when input ca array is null or undefined', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca, undefined);
  globalAgent.addCACertificates(undefined);
  globalAgent.addCACertificates(null);
  t.is(globalAgent.ca, undefined);
  const response: HttpResponseType = await new Promise((resolve) => {
    // @ts-expect-error seems 'secureEndpoint' property is not supported by RequestOptions but it should be.
    https.get('https://127.0.0.1', {ca: ['test-ca'], secureEndpoint: true, servername: '127.0.0.1'}, createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('Test initializing ca certificate property while creating global proxy agent', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent({ca: ['test-ca']});

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;
  const globalAgent: any = https.globalAgent;
  t.is(globalAgent.ca.length, 1);
  t.is(globalAgent.ca[0], 'test-ca');
  const response: HttpResponseType = await new Promise((resolve) => {
    // @ts-expect-error seems 'secureEndpoint' property is not supported by RequestOptions but it should be.
    https.get('https://127.0.0.1', {rejectUnauthorized: false, secureEndpoint: true}, createHttpResponseResolver(resolve));
  });
  t.is(response.body, 'OK');
});

serial('proxies HTTPS request', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTP_PROXY = proxyServer.url;

  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', {}, createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');
});

serial('proxies HTTPS request with proxy-authorization header', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const beforeDealHttpsRequest = sinon.stub().callsFake(async () => {
    return true;
  });

  const proxyServer = await createProxyServer({
    beforeDealHttpsRequest,
    beforeSendRequest: anyproxyDefaultRules.beforeSendRequest,
  });

  globalProxyAgent.HTTP_PROXY = 'http://foo@127.0.0.1:' + proxyServer.port;

  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', {}, createHttpResponseResolver(resolve));
  });

  t.is(response.body, 'OK');

  t.is(beforeDealHttpsRequest.firstCall.args[0]._req.headers['proxy-authorization'], 'Basic Zm9v');
});

serial('does not produce unhandled rejection when cannot connect to proxy', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const port = await getNextPort();

  globalProxyAgent.HTTP_PROXY = 'http://127.0.0.1:' + port;

  await t.throwsAsync(got('http://127.0.0.1'));
});

serial('proxies HTTPS request with dedicated proxy', async (t) => {
  const globalProxyAgent = createGlobalProxyAgent();

  const proxyServer = await createProxyServer();

  globalProxyAgent.HTTPS_PROXY = proxyServer.url;

  const response: HttpResponseType = await new Promise((resolve) => {
    https.get('https://127.0.0.1', {}, createHttpResponseResolver(resolve));
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
