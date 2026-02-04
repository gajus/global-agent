import {
  expect,
  test,
} from 'vitest';
import parseProxyUrl from './parseProxyUrl';

test('extracts hostname', () => {
  expect(parseProxyUrl('http://0.0.0.0').hostname).toBe('0.0.0.0');
});

test('extracts port', () => {
  expect(parseProxyUrl('http://0.0.0.0:3000').port).toBe(3_000);
});

test('extracts authorization', () => {
  expect(parseProxyUrl('http://foo:bar@0.0.0.0').authorization).toBe('foo:bar');
});

test('throws an error if protocol is not "http:"', () => {
  expect(() => {
    parseProxyUrl('https://0.0.0.0:3000');
  }).toThrow('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL protocol must be "http:".');
});

test('throws an error if query is present', () => {
  expect(() => {
    parseProxyUrl('http://0.0.0.0:3000/?foo=bar');
  }).toThrow('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have query.');
});

test('throws an error if hash is present', () => {
  expect(() => {
    parseProxyUrl('http://0.0.0.0:3000/#foo');
  }).toThrow('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have hash.');
});
