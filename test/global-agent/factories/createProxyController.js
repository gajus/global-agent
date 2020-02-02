// @flow

import test from 'ava';
import createProxyController from '../../../src/factories/createProxyController';

test('sets HTTP_PROXY', (t) => {
  const globalAgentGlobal = createProxyController();

  globalAgentGlobal.HTTP_PROXY = 'http://127.0.0.1';

  t.is(globalAgentGlobal.HTTP_PROXY, 'http://127.0.0.1');
});

test('sets HTTPS_PROXY', (t) => {
  const globalAgentGlobal = createProxyController();

  globalAgentGlobal.HTTPS_PROXY = 'http://127.0.0.1';

  t.is(globalAgentGlobal.HTTPS_PROXY, 'http://127.0.0.1');
});

test('sets NO_PROXY', (t) => {
  const globalAgentGlobal = createProxyController();

  globalAgentGlobal.NO_PROXY = '*';

  t.is(globalAgentGlobal.NO_PROXY, '*');
});

test('throws an error if unknown property is set', (t) => {
  const globalAgentGlobal = createProxyController();

  const error = t.throws(() => {
    // $FlowFixMe
    globalAgentGlobal.FOO = 'BAR';
  });

  t.is(error.message, 'Cannot set an unmapped property "FOO".');
});
