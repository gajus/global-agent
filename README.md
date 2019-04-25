# global-agent

[![Travis build status](http://img.shields.io/travis/gajus/global-agent/master.svg?style=flat-square)](https://travis-ci.org/gajus/global-agent)
[![Coveralls](https://img.shields.io/coveralls/gajus/global-agent.svg?style=flat-square)](https://coveralls.io/github/gajus/global-agent)
[![NPM version](http://img.shields.io/npm/v/global-agent.svg?style=flat-square)](https://www.npmjs.org/package/global-agent)
[![Canonical Code Style](https://img.shields.io/badge/code%20style-canonical-blue.svg?style=flat-square)](https://github.com/gajus/canonical)
[![Twitter Follow](https://img.shields.io/twitter/follow/kuizinas.svg?style=social&label=Follow)](https://twitter.com/kuizinas)

Global HTTP/HTTPS proxy configurable using environment variables.

* [Usage](#usage)
  * [Setup proxy](#setup-proxy)
  * [Enable logging](#enable-logging)
* [Supported libraries](#supported-libraries)
* [FAQ](#faq)
  * [How does it work?](#how-does-it-work)
  * [What version of Node.js are supported?](#what-version-of-nodejs-are-supported)
  * [What is the reason `global-agent` does not use the standard `HTTP_PROXY` environment variable?](#what-is-the-reason-global-agent-does-not-use-the-standard-http-proxy-environment-variable)
  * [What is the difference from `global-tunnel`?](#what-is-the-difference-from-global-tunnel)

## Usage

### Setup proxy

To configure HTTP proxy:

1. Import `global-agent/bootstrap`.
1. Export HTTP proxy address as `GLOBAL_AGENT_HTTP_PROXY` environment variable.

Code:

```js
import 'global-agent/bootstrap';

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

### Enable logging

`global-agent` is using [`roarr`](https://www.npmjs.com/package/roarr) logger to log HTTP requests.

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

`global-agent` works be configuring [`http.globalAgent`](https://nodejs.org/api/http.html#http_http_globalagent) and [`https.globalAgent`](https://nodejs.org/api/https.html#https_https_globalagent).

### What version of Node.js are supported?

`global-agent` works with Node.js v12.0.0 and above.

### What is the reason `global-agent` does not use the standard `HTTP_PROXY` environment variable?

Some libraries (e.g. [`request`](https://npmjs.org/package/request)) change their behaviour when `HTTP_PROXY` environment variable is present. Using a namespaced environment variable prevents conflicting library behaviour.

### What is the difference from `global-tunnel`?

[`global-tunnel`](https://github.com/salesforce/global-tunnel) (and [`global-tunnel-ng`](https://github.com/np-maintain/global-tunnel)) are designed to support legacy Node.js versions and rely on [monkey-patching `http.request`, `http.get`, `https.request` and `https.get` methods](https://github.com/np-maintain/global-tunnel/blob/51413dcf0534252b5049ec213105c7063ccc6367/index.js#L302-L338). `global-agent` works by configuring [`http.globalAgent`](https://nodejs.org/api/http.html#http_http_globalagent).

