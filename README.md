# global-agent

[![Travis build status](http://img.shields.io/travis/gajus/global-agent/master.svg?style=flat-square)](https://travis-ci.org/gajus/global-agent)
[![Coveralls](https://img.shields.io/coveralls/gajus/global-agent.svg?style=flat-square)](https://coveralls.io/github/gajus/global-agent)
[![NPM version](http://img.shields.io/npm/v/global-agent.svg?style=flat-square)](https://www.npmjs.org/package/global-agent)
[![Canonical Code Style](https://img.shields.io/badge/code%20style-canonical-blue.svg?style=flat-square)](https://github.com/gajus/canonical)
[![Twitter Follow](https://img.shields.io/twitter/follow/kuizinas.svg?style=social&label=Follow)](https://twitter.com/kuizinas)

Global HTTP/HTTPS proxy configurable using environment variables.

* [Usage](#usage)
  * [Setup proxy](#setup-proxy)
  * [Runtime configuration](#runtime-configuration)
  * [Exclude URLs](#exclude-urls)
  * [Enable logging](#enable-logging)
* [Supported libraries](#supported-libraries)
* [FAQ](#faq)
  * [How does it work?](#how-does-it-work)
  * [What version of Node.js are supported?](#what-version-of-nodejs-are-supported)
  * [What is the reason `global-agent` does not use `HTTP_PROXY`?](#what-is-the-reason-global-agent-does-not-use-http-proxy)
  * [What is the difference from `global-tunnel`?](#what-is-the-difference-from-global-tunnel)

## Usage

### Setup proxy

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

### Runtime configuration

`global-agent/bootstrap` script copies `process.env.GLOBAL_AGENT_HTTP_PROXY` value to `global.GLOBAL_AGENT.HTTP_PROXY` and continues to use the latter variable.

You can override the `global.GLOBAL_AGENT.HTTP_PROXY` value at runtime to change proxy behaviour, e.g.

```js
http.get('http://127.0.0.1:8000');

global.GLOBAL_AGENT.HTTP_PROXY = 'http://127.0.0.1:8001';

http.get('http://127.0.0.1:8000');

global.GLOBAL_AGENT.HTTP_PROXY = 'http://127.0.0.1:8002';

```

First HTTP request is going to use http://127.0.0.1:8001 proxy and secord request is going to use http://127.0.0.1:8002.

All `global-agent` configuration is available under `global.GLOBAL_AGENT` namespace.

### Exclude URLs

The `GLOBAL_AGENT_NO_PROXY` environment variable specifies URLs that should be excluded from proxying. `GLOBAL_AGENT_NO_PROXY` value is a comma-separated list of domain names. Asterisks can be used as wildcards, e.g.

```bash
export GLOBAL_AGENT_NO_PROXY='*.foo.com,baz.com'

```

says to contact all machines with the 'foo.com' TLD and 'baz.com' domains directly.

### Enable logging

`global-agent` is using [`roarr`](https://www.npmjs.com/package/roarr) logger to log HTTP requests, e.g.

```json
{"context":{"program":"global-agent","namespace":"Agent","logLevel":10,"destination":"https://dev.to:443/api/tags%3Fpage=1","proxy":"http://127.0.0.1:8076"},"message":"proxying request","sequence":23,"time":1556269669663,"version":"1.0.0"}
{"context":{"program":"global-agent","namespace":"Agent","logLevel":10,"destination":"https://dev.to:443/api/tags%3Fpage=2","proxy":"http://127.0.0.1:8076"},"message":"proxying request","sequence":24,"time":1556269670311,"version":"1.0.0"}

```

Export `ROARR_LOG=true` environment variable to enable log printing to stdout.

Use [`roarr-cli`](https://github.com/gajus/roarr-cli) program to pretty-print the logs.

## Supported libraries

`global-agent` works with all libraries that internally use [`http.request`](https://nodejs.org/api/http.html#http_http_request_options_callback).

`global-agent` has been tested to work with:

* [`got`](https://www.npmjs.com/package/got)
* [`axios`](https://www.npmjs.com/package/axios)
* [`request`](https://www.npmjs.com/package/axios)

## FAQ

### How does it work?

`global-agent` configures [`http.globalAgent`](https://nodejs.org/api/http.html#http_http_globalagent) and [`https.globalAgent`](https://nodejs.org/api/https.html#https_https_globalagent) to use a custom [Agent](https://nodejs.org/api/http.html#http_class_http_agent) for HTTP and HTTPS.

### What versions of Node.js are supported?

`global-agent` works with Node.js v11.7.0 and above.

### What is the reason `global-agent` does not use `HTTP_PROXY`?

Some libraries (e.g. [`request`](https://npmjs.org/package/request)) change their behaviour when `HTTP_PROXY` environment variable is present. Using a namespaced environment variable prevents conflicting library behaviour.

### What is the difference from `global-tunnel` and `tunnel`?

[`global-tunnel`](https://github.com/salesforce/global-tunnel) (including [`global-tunnel-ng`](https://github.com/np-maintain/global-tunnel) and [`tunnel`](https://npmjs.com/package/tunnel)) are designed to support legacy Node.js versions. They use various [workarounds](https://github.com/koichik/node-tunnel/blob/5fb2fb424788597146b7be6729006cad1cf9e9a8/lib/tunnel.js#L134-L144) and rely on [monkey-patching `http.request`, `http.get`, `https.request` and `https.get` methods](https://github.com/np-maintain/global-tunnel/blob/51413dcf0534252b5049ec213105c7063ccc6367/index.js#L302-L338).

In contrast, `global-agent` supports only Node.js v11.7.0 and above, and works by configuring [`http.globalAgent`](https://nodejs.org/api/http.html#http_http_globalagent).
