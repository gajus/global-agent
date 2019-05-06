// @flow

/* eslint-disable no-process-env */

import http from 'http';
import https from 'https';
import getPort from 'get-port';
import got from 'got';
import axios from 'axios';
import makeRequest from 'request';
import AnyProxy, {
  ProxyServer
} from 'anyproxy';
import test, {
  before,
  afterEach,
  beforeEach
} from 'ava';
import bootstrap from '../../../src/routines/bootstrap';

const defaultHttpAgent = http.globalAgent;
const defaultHttpsAgent = https.globalAgent;

let lastPort = 3000;

let localProxyServers = [];
let localHttpServers = [];

const getNextPort = (): Promise<number> => {
  return getPort({
    port: getPort.makeRange(lastPort++, 3500)
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
  global.GLOBAL_AGENT = {};

  // $FlowFixMe
  http.globalAgent = defaultHttpAgent;

  // $FlowFixMe
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

const createHttpResponseResolver = (resolve) => {
  return (response) => {
    let body = '';

    response.on('data', (data) => {
      body += data;
    });

    response.on('end', () => {
      resolve({
        body,
        headers: response.headers,
        statusCode: response.statusCode
      });
    });
  };
};

const createProxyServer = async () => {
  const port = await getNextPort();

  const localProxyServer = await new Promise((resolve) => {
    const proxyServer = new ProxyServer({
      forceProxyHttps: true,
      port,
      rule: {
        beforeSendRequest: () => {
          return {
            response: {
              body: 'OK',
              header: {
                'content-type': 'text/plain'
              },
              statusCode: 200
            }
          };
        }
      }
    });

    proxyServer.on('ready', () => {
      resolve({
        stop: () => {
          proxyServer.close();
        },
        url: 'http://127.0.0.1:' + port
      });
    });

    proxyServer.start();
  });

  localProxyServers.push(localProxyServer);

  return localProxyServer;
};

const createHttpServer = async () => {
  const port = await getNextPort();

  const localHttpServer = await new Promise((resolve) => {
    const httpServer = http.createServer((request, response) => {
      response.end('DIRECT');
    });

    httpServer.listen(port, () => {
      resolve({
        stop: () => {
          httpServer.close();
        },
        url: 'http://127.0.0.1:' + port
      });
    });
  });

  localHttpServers.push(localHttpServer);

  return localHttpServer;
};

test('proxies HTTP request', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await new Promise((resolve) => {
    http.get('http://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.assert(response.body === 'OK');
});

test('proxies HTTPS request', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await new Promise((resolve) => {
    https.get('https://127.0.0.1', createHttpResponseResolver(resolve));
  });

  t.assert(response.body === 'OK');
});

test('forwards requests matching NO_PROXY', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();
  const httpServer = await createHttpServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;
  global.GLOBAL_AGENT.NO_PROXY = '127.0.0.1';

  const response = await new Promise((resolve) => {
    http.get(httpServer.url, createHttpResponseResolver(resolve));
  });

  t.assert(response.body === 'DIRECT');
});

test('proxies HTTP request (using got)', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await got('http://127.0.0.1');

  t.assert(response.body === 'OK');
});

test('proxies HTTPS request (using got)', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await got('https://127.0.0.1');

  t.assert(response.body === 'OK');
});

test('proxies HTTP request (using axios)', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await axios.get('http://127.0.0.1');

  t.assert(response.data === 'OK');
});

test('proxies HTTPS request (using axios)', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await axios.get('https://127.0.0.1');

  t.assert(response.data === 'OK');
});

test('proxies HTTP request (using request)', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await new Promise((resolve) => {
    makeRequest('http://127.0.0.1', (error, requestResponse, body) => {
      t.assert(error === null);

      resolve(body);
    });
  });

  t.assert(response === 'OK');
});

test('proxies HTTPS request (using request)', async (t) => {
  bootstrap();

  const proxyServer = await createProxyServer();

  global.GLOBAL_AGENT.HTTP_PROXY = proxyServer.url;

  const response = await new Promise((resolve) => {
    makeRequest('https://127.0.0.1', (error, requestResponse, body) => {
      t.assert(error === null);

      resolve(body);
    });
  });

  t.assert(response === 'OK');
});
