# global-agent

[![NPM version](http://img.shields.io/npm/v/global-agent.svg?style=flat-square)](https://www.npmjs.org/package/global-agent)
[![Canonical Code Style](https://img.shields.io/badge/code%20style-canonical-blue.svg?style=flat-square)](https://github.com/gajus/canonical)
[![Twitter Follow](https://img.shields.io/twitter/follow/kuizinas.svg?style=social&label=Follow)](https://twitter.com/kuizinas)

Global HTTP/HTTPS proxy configurable using environment variables.

* [Usage](#usage)
  * [Setup proxy using `global-agent/bootstrap`](#setup-proxy-using-global-agentbootstrap)
  * [Setup proxy using `bootstrap` routine](#setup-proxy-using-bootstrap-routine)
  * [Runtime configuration](#runtime-configuration)
  * [Exclude URLs](#exclude-urls)
* [API](#api)
  * [`createGlobalProxyAgent`](#createglobalproxyagent)
  * [Environment variables](#environment-variables)
  * [`global.GLOBAL_AGENT`](#globalglobal_agent)
* [Supported libraries](#supported-libraries)
* [FAQ](#faq)
  * [What is the reason `global-agent` overrides explicitly configured HTTP(S) agent?](#what-is-the-reason-global-agent-overrides-explicitly-configured-https-agent)
  * [What is the reason `global-agent/bootstrap` does not use `HTTP_PROXY`?](#what-is-the-reason-global-agentbootstrap-does-not-use-http_proxy)
  * [What is the difference from `global-tunnel` and `tunnel`?](#what-is-the-difference-from-global-tunnel-and-tunnel)

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
import globalTunnel from 'global-tunnel-ng';

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

The first HTTP request is going to use http://127.0.0.1:8001 proxy and the second request is going to use http://127.0.0.1:8002.

All `global-agent` configuration is available under `global.GLOBAL_AGENT` namespace.

### Exclude URLs

The `GLOBAL_AGENT_NO_PROXY` environment variable specifies a pattern of URLs that should be excluded from proxying. `GLOBAL_AGENT_NO_PROXY` value is a comma-separated list of domain names. Asterisks can be used as wildcards, e.g.

```bash
export GLOBAL_AGENT_NO_PROXY='*.foo.com,baz.com'

```

says to contact all machines with the 'foo.com' TLD and 'baz.com' domains directly.

### Separate proxy for HTTPS

The environment variable `GLOBAL_AGENT_HTTPS_PROXY` can be set to specify a separate proxy for HTTPS requests. When this variable is not set `GLOBAL_AGENT_HTTP_PROXY` is used for both HTTP and HTTPS requests.

## API

### `createGlobalProxyAgent`

```js
/**
 * @property environmentVariableNamespace Defines namespace of `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY` environment variables. (Default: `GLOBAL_AGENT_`)
 * @property forceGlobalAgent Forces to use `global-agent` HTTP(S) agent even when request was explicitly constructed with another agent. (Default: `true`)
 * @property socketConnectionTimeout Destroys socket if connection is not established within the timeout. (Default: `60000`)
 * @property ca Single CA certificate or an array of CA certificates that is trusted for secure connections to the registry.
 * @property logger Custom logger instance for debug logging. Must implement `child`, `debug`, `error`, `info`, `trace`, and `warn` methods.
 */
type ProxyAgentConfigurationInputType = {|
  +environmentVariableNamespace?: string,
  +forceGlobalAgent?: boolean,
  +socketConnectionTimeout?: number,
  +ca?: string[] | string,
  +logger?: Logger,
|};

(configurationInput: ProxyAgentConfigurationInputType) => ProxyAgentConfigurationType;

```

### Custom Logger

You can provide a custom logger to `global-agent` for debugging purposes. The logger must implement the following interface:

```ts
type Logger = {
  child: (context: object) => Logger,
  debug: (context: object | string, message?: string) => void,
  error: (context: object | string, message?: string) => void,
  info: (context: object | string, message?: string) => void,
  trace: (context: object | string, message?: string) => void,
  warn: (context: object | string, message?: string) => void,
};
```

Example using a custom logger:

```js
import { createGlobalProxyAgent } from 'global-agent';

createGlobalProxyAgent({
  logger: {
    child: () => logger,
    debug: console.debug,
    error: console.error,
    info: console.info,
    trace: console.trace,
    warn: console.warn,
  },
});
```

### Environment variables

|Name|Description|Default|
|---|---|---|
|`GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE`|Defines namespace of `HTTP_PROXY`, `HTTPS_PROXY` and `NO_PROXY` environment variables.|`GLOBAL_AGENT_`|
|`GLOBAL_AGENT_FORCE_GLOBAL_AGENT`|Forces to use `global-agent` HTTP(S) agent even when request was explicitly constructed with another agent.|`true`|
|`GLOBAL_AGENT_SOCKET_CONNECTION_TIMEOUT`|Destroys socket if connection is not established within the timeout.|`60000`|
|`${NAMESPACE}HTTP_PROXY`|Sets the initial proxy controller HTTP_PROXY value.|N/A|
|`${NAMESPACE}HTTPS_PROXY`|Sets the initial proxy controller HTTPS_PROXY value.|N/A|
|`${NAMESPACE}NO_PROXY`|Sets the initial proxy controller NO_PROXY value.|N/A|

### `global.GLOBAL_AGENT`

`global.GLOBAL_AGENT` is initialized by `bootstrap` routine.

`global.GLOBAL_AGENT` has the following properties:

|Name|Configurable|Description|
|---|---|---|
|`HTTP_PROXY`|Yes|Sets HTTP proxy to use.|
|`HTTPS_PROXY`|Yes|Sets a distinct proxy to use for HTTPS requests.|
|`NO_PROXY`|Yes|Specifies a pattern of URLs that should be excluded from proxying. See [Exclude URLs](#exclude-urls).|

## Certificate Authority (CA)

### `addCACertificates`
This method can be accessed using https to add CA certificates to the global-agent.

Uses:
```js
if (typeof https.globalAgent.addCACertificates === 'function') {
  //certificate - an array of ca certificates to be added to the global-agent
  https.globalAgent.addCACertificates(certificate);
}
```

Method Definition:
```js
/**
 * This method can be used to append new ca certificates to existing ca certificates
 * @param {string[] | string} ca a ca certificate or an array of ca certificates
 */
public addCACertificates (ca: string[] | string) {
  if (!ca) {
    log.error('Invalid input ca certificate');
  } else if (this.ca) {
    if (typeof ca === typeof this.ca) {
      // concat valid ca certificates with the existing certificates,
      if (typeof this.ca === 'string') {
        this.ca = this.ca.concat(ca as string);
      } else {
        this.ca = this.ca.concat(ca as string[]);
      }
    } else {
      log.error('Input ca certificate type mismatched with existing ca certificate type');
    }
  } else {
    this.ca = ca;
  }
}
```

### `clearCACertificates`
This method can be accessed using https to clear existing CA certificates from global-agent.

Uses:
```js
if (typeof https.globalAgent.clearCACertificates === 'function') {
  https.globalAgent.clearCACertificates();
}
```
Method Definition:
```js
/**
 * This method clears existing CA Certificates.
 * It sets ca to undefined
 */
public clearCACertificates () {
  this.ca = undefined;
}
```

## Supported libraries

`global-agent` works with all libraries that internally use [`http.request`](https://nodejs.org/api/http.html#http_http_request_options_callback).

`global-agent` has been tested to work with:

* [`got`](https://www.npmjs.com/package/got)
* [`axios`](https://www.npmjs.com/package/axios)
* [`request`](https://www.npmjs.com/package/request)

## FAQ

### What is the reason `global-agent` overrides explicitly configured HTTP(S) agent?

By default, `global-agent` overrides [`agent` property](https://nodejs.org/api/http.html#http_http_request_options_callback) of any HTTP request, even if `agent` property was explicitly set when constructing a HTTP request. This behaviour allows to intercept requests of libraries that use a custom instance of an agent per default (e.g. Stripe SDK [uses an `http(s).globalAgent` instance pre-configured with `keepAlive: true`](https://github.com/stripe/stripe-node/blob/e542902dd8fbe591fe3c3ce07a7e89d1d60e4cf7/lib/StripeResource.js#L11-L12)).

This behaviour can be disabled with `GLOBAL_AGENT_FORCE_GLOBAL_AGENT=false` environment variable. When disabled, then `global-agent` will only set `agent` property when it is not already defined or if `agent` is an instance of `http(s).globalAgent`.

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
