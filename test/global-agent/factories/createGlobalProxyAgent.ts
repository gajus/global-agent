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
