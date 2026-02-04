import {
  expect,
  test,
} from 'vitest';
import createProxyController from './createProxyController';

test('sets HTTP_PROXY', () => {
  const globalAgentGlobal = createProxyController();

  globalAgentGlobal.HTTP_PROXY = 'http://127.0.0.1';

  expect(globalAgentGlobal.HTTP_PROXY).toBe('http://127.0.0.1');
});

test('sets HTTPS_PROXY', () => {
  const globalAgentGlobal = createProxyController();

  globalAgentGlobal.HTTPS_PROXY = 'http://127.0.0.1';

  expect(globalAgentGlobal.HTTPS_PROXY).toBe('http://127.0.0.1');
});

test('sets NO_PROXY', () => {
  const globalAgentGlobal = createProxyController();

  globalAgentGlobal.NO_PROXY = '*';

  expect(globalAgentGlobal.NO_PROXY).toBe('*');
});

test('throws an error if unknown property is set', () => {
  const globalAgentGlobal = createProxyController();

  expect(() => {
    // @ts-expect-error expected unknown property.
    globalAgentGlobal.FOO = 'BAR';
  }).toThrow('Cannot set an unmapped property "FOO".');
});
