# global-agent

[![GitSpo Mentions](https://gitspo.com/badges/mentions/gajus/global-agent?style=flat-square)](https://gitspo.com/mentions/gajus/global-agent)
[![Travis build status](http://img.shields.io/travis/gajus/global-agent/master.svg?style=flat-square)](https://travis-ci.org/gajus/global-agent)
[![Coveralls](https://img.shields.io/coveralls/gajus/global-agent.svg?style=flat-square)](https://coveralls.io/github/gajus/global-agent)
[![NPM version](http://img.shields.io/npm/v/global-agent.svg?style=flat-square)](https://www.npmjs.org/package/global-agent)
[![Canonical Code Style](https://img.shields.io/badge/code%20style-canonical-blue.svg?style=flat-square)](https://github.com/gajus/canonical)
[![Twitter Follow](https://img.shields.io/twitter/follow/kuizinas.svg?style=social&label=Follow)](https://twitter.com/kuizinas)

Global HTTP/HTTPS proxy configurable using environment variables.

* [Usage](#usage)
  * [Setup proxy using `global-agent/bootstrap`](#setup-proxy-using-global-agentbootstrap)
  * [Setup proxy using `bootstrap` routine](#setup-proxy-using-bootstrap-routine)
  * [Runtime configuration](#runtime-configuration)
  * [Exclude URLs](#exclude-urls)
  * [Enable logging](#enable-logging)
  * [Events](#events)
* [API](#api)
  * [`global.GLOBAL_AGENT`](#globalglobal_agent)
* [Supported libraries](#supported-libraries)
* [FAQ](#faq)
  * [How does it work?](#how-does-it-work)
  * [What version of Node.js are supported?](#what-version-of-nodejs-are-supported)
  * [What is the reason `global-agent` does not use `HTTP_PROXY`?](#what-is-the-reason-global-agent-does-not-use-http-proxy)
  * [What is the difference from `global-tunnel`?](#what-is-the-difference-from-global-tunnel)

## Usage

### Setup proxy using `global-agent/bootstrap`

To configure HTTP proxy:

1. Import `global-agent/bootstrap`.
1. Export HTTP proxy address as `GLOBAL_AGENT_HTTP_PROXY` environment variable.

Code:

```js
import 'global-agent/bootstrap';

// or:
// import {bootstrap} from 'global-agent';
// bootstrap();

```

Bash:

```bash
$ export GLOBAL_AGENT_HTTP_PROXY=http://127.0.0.1:8080

```

Alternatively, you can preload module using Node.js `--require, -r` configuration, e.g.

```bash
$ export GLOBAL_AGENT_HTTP_PROXY=http://127.0.0.1:8080
$ node -r 'global-agent/bootstrap' your-script.js

```

### Setup proxy using `bootstrap` routine

Instead of importing a self-initialising script with side-effects as demonstrated in the [setup proxy using `global-agent/bootstrap`](#setup-proxy-using-global-agentbootstrap) documentation, you can import `bootstrap` routine and explicitly evaluate the bootstrap logic, e.g.

```js
import {
  bootstrap
} from 'global-agent';

bootstrap();

```

This is useful if you need to conditionally bootstrap `global-agent`, e.g.

```js
import {
  bootstrap
} from 'global-agent';
import globalTunner from 'global-tunnel-ng';

const MAJOR_NODEJS_VERSION = parseInt(process.version.slice(1).split('.')[0], 10);

if (MAJOR_NODEJS_VERSION >= 10) {
  // `global-agent` works with Node.js v10 and above.
  bootstrap();
} else {
  // `global-tunnel-ng` works only with Node.js v10 and below.
  globalTunnel.initialize();
}

```

### Setup proxy using `createGlobalProxyAgent`

If you do not want to use `global.GLOBAL_AGENT` variable, then you can use `createGlobalProxyAgent` to instantiate a controlled instance of `global-agent`, e.g.

```js
import {
  createGlobalProxyAgent
} from 'global-agent';

const globalProxyAgent = createGlobalProxyAgent();

```

Unlike `bootstrap` routine, `createGlobalProxyAgent` factory does not create `global.GLOBAL_AGENT` variable and does not guard against multiple initializations of `global-agent`. The result object of `createGlobalProxyAgent` is equivalent to `global.GLOBAL_AGENT`.

### Runtime configuration

`global-agent/bootstrap` script copies `process.env.GLOBAL_AGENT_HTTP_PROXY` value to `global.GLOBAL_AGENT.HTTP_PROXY` and continues to use the latter variable.

You can override the `global.GLOBAL_AGENT.HTTP_PROXY` value at runtime to change proxy behaviour, e.g.

```js
http.get('http://127.0.0.1:8000');

global.GLOBAL_AGENT.HTTP_PROXY = 'http://127.0.0.1:8001';

http.get('http://127.0.0.1:8000');

global.GLOBAL_AGENT.HTTP_PROXY = 'http://127.0.0.1:8002';

```

The first HTTP request is going to use http://127.0.0.1:8001 proxy and the secord request is going to use http://127.0.0.1:8002.

All `global-agent` configuration is available under `global.GLOBAL_AGENT` namespace.

### Exclude URLs

The `GLOBAL_AGENT_NO_PROXY` environment variable specifies a pattern of URLs that should be excluded from proxying. `GLOBAL_AGENT_NO_PROXY` value is a comma-separated list of domain names. Asterisks can be used as wildcards, e.g.

```bash
export GLOBAL_AGENT_NO_PROXY='*.foo.com,baz.com'

```

says to contact all machines with the 'foo.com' TLD and 'baz.com' domains directly.

### Separate proxy for HTTPS

The environment variable `GLOBAL_AGENT_HTTPS_PROXY` can be set to specify a separate proxy for HTTPS requests. When this variable is not set `GLOBAL_AGENT_HTTP_PROXY` is used for both HTTP and HTTPS requests.

### Enable logging

`global-agent` is using [`roarr`](https://www.npmjs.com/package/roarr) logger to log HTTP requests and response (HTTP status code and headers), e.g.

```json
{"context":{"program":"global-agent","namespace":"Agent","logLevel":10,"destination":"http://gajus.com","proxy":"http://127.0.0.1:8076"},"message":"proxying request","sequence":1,"time":1556269669663,"version":"1.0.0"}
{"context":{"program":"global-agent","namespace":"Agent","logLevel":10,"headers":{"content-type":"text/plain","content-length":"2","date":"Fri, 26 Apr 2019 12:07:50 GMT","connection":"close"},"requestId":6,"statusCode":200},"message":"proxying response","sequence":2,"time":1557133856955,"version":"1.0.0"}

```

Export `ROARR_LOG=true` environment variable to enable log printing to stdout.

Use [`roarr-cli`](https://github.com/gajus/roarr-cli) program to pretty-print the logs.

### Events

`global.GLOBAL_AGENT.eventEmitter` is an instance of a Node.js [event emitter](https://nodejs.org/api/events.html).

* `request` event is emitted when a new HTTP request is proxied usign `global-agent` HTTP(S) agent.

Example:

```js
global.GLOBAL_AGENT.eventEmitter.on('request', (request) => {
  request.once('response', (response) => {
    console.log({
      request,
      response
    });
  });
});

```

## API

### `global.GLOBAL_AGENT`

`global.GLOBAL_AGENT` is initialized by `bootstrap` routine.

`global.GLOBAL_AGENT` has the following properties:

|Name|Description|Configurable|
|---|---|---|
|`HTTP_PROXY`|Yes|Sets HTTP proxy to use.|
|`HTTPS_PROXY`|Yes|Sets a distinct proxy to use for HTTPS requests.|
|`NO_PROXY`|Yes|Specifies a pattern of URLs that should be excluded from proxying. See [Exclude URLs](#exclude-urls).|

## Supported libraries

`global-agent` works with all libraries that internally use [`http.request`](https://nodejs.org/api/http.html#http_http_request_options_callback).

`global-agent` has been tested to work with:

* [`got`](https://www.npmjs.com/package/got)
* [`axios`](https://www.npmjs.com/package/axios)
* [`request`](https://www.npmjs.com/package/axios)

## FAQ

### How does it work?

`global-agent` configures [`http.globalAgent`](https://nodejs.org/api/http.html#http_http_globalagent) and [`https.globalAgent`](https://nodejs.org/api/https.html#https_https_globalagent) to use a custom [Agent](https://nodejs.org/api/http.html#http_class_http_agent) for HTTP and HTTPS, and ensures that all requests made with the built-in `http` and `https` modules use these agents.

### What versions of Node.js are supported?

`global-agent` has been tested to work with Node v10 and above.

* `global-agent` works with Node.js [v11.7.0](https://nodejs.org/uk/blog/release/v11.7.0/) and above by overriding the `http(s).globalAgent`.
* `global-agent` works with Node.js v11.6 and below by overriding the `http(s).get` and `http(s).request` methods.

### What is the reason `global-agent/bootstrap` does not use `HTTP_PROXY`?

Some libraries (e.g. [`request`](https://npmjs.org/package/request)) change their behaviour when `HTTP_PROXY` environment variable is present. Using a namespaced environment variable prevents conflicting library behaviour.

You can override this behaviour by configuring `GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE` variable, e.g.

```bash
$ export GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE=

```

Now script initialized using `global-agent/bootstrap` will use `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY` environment variables.

### What is the difference from `global-tunnel` and `tunnel`?

[`global-tunnel`](https://github.com/salesforce/global-tunnel) (including [`global-tunnel-ng`](https://github.com/np-maintain/global-tunnel) and [`tunnel`](https://npmjs.com/package/tunnel)) are designed to support legacy Node.js versions. They use various [workarounds](https://github.com/koichik/node-tunnel/blob/5fb2fb424788597146b7be6729006cad1cf9e9a8/lib/tunnel.js#L134-L144) and rely on [monkey-patching `http.request`, `http.get`, `https.request` and `https.get` methods](https://github.com/np-maintain/global-tunnel/blob/51413dcf0534252b5049ec213105c7063ccc6367/index.js#L302-L338).

In contrast, `global-agent` supports Node.js v10 and above, and does not implements workarounds for the older Node.js versions.
