// @flow

import test from 'ava';
import parseProxyUrl from '../../../src/utilities/parseProxyUrl';

test('extracts hostname', (t) => {
  t.assert(parseProxyUrl('http://0.0.0.0').hostname === '0.0.0.0');
});

test('extracts port', (t) => {
  t.assert(parseProxyUrl('http://0.0.0.0:3000').port === 3000);
});

test('extracts authorization', (t) => {
  t.assert(parseProxyUrl('http://foo:bar@0.0.0.0').authorization === 'foo:bar');
});

test('throws an error if protocol is not "http:"', (t) => {
  t.throws(() => {
    parseProxyUrl('https://0.0.0.0:3000');
  }, 'Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL protocol must be "http:".');
});

test('throws an error if query is present', (t) => {
  t.throws(() => {
    parseProxyUrl('http://0.0.0.0:3000/?foo=bar');
  }, 'Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have query.');
});

test('throws an error if hash is present', (t) => {
  t.throws(() => {
    parseProxyUrl('http://0.0.0.0:3000/#foo');
  }, 'Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have hash.');
});
