// @flow

import test from 'ava';
import createGlobalAgentGlobal from '../../../src/factories/createGlobalAgentGlobal';

test('defaults bootstrapped to false', (t) => {
  const globalAgentGlobal = createGlobalAgentGlobal();

  t.is(globalAgentGlobal.bootstrapped, false);
});

test('sets bootstrapped', (t) => {
  const globalAgentGlobal = createGlobalAgentGlobal();

  globalAgentGlobal.bootstrapped = true;

  t.is(globalAgentGlobal.bootstrapped, true);
});

test('sets HTTP_PROXY', (t) => {
  const globalAgentGlobal = createGlobalAgentGlobal();

  globalAgentGlobal.HTTP_PROXY = 'http://127.0.0.1';

  t.is(globalAgentGlobal.HTTP_PROXY, 'http://127.0.0.1');
});

test('sets HTTPS_PROXY', (t) => {
  const globalAgentGlobal = createGlobalAgentGlobal();

  globalAgentGlobal.HTTPS_PROXY = 'http://127.0.0.1';

  t.is(globalAgentGlobal.HTTPS_PROXY, 'http://127.0.0.1');
});

test('sets NO_PROXY', (t) => {
  const globalAgentGlobal = createGlobalAgentGlobal();

  globalAgentGlobal.NO_PROXY = '*';

  t.is(globalAgentGlobal.NO_PROXY, '*');
});

test('throws an error if unknown property is set', (t) => {
  const globalAgentGlobal = createGlobalAgentGlobal();

  t.throws(() => {
    // $FlowFixMe
    globalAgentGlobal.FOO = 'BAR';
  }, 'Cannot set an unmapped property "FOO".');
});
