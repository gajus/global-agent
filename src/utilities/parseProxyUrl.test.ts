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

test('decodes percent-encoded username and password', () => {
  expect(parseProxyUrl('http://me%40corp:p%3Ass%25@0.0.0.0').authorization).toBe('me@corp:p:ss%');
});

test('decodes percent-encoded username without password', () => {
  expect(parseProxyUrl('http://me%40corp@0.0.0.0').authorization).toBe('me@corp');
});

test('decodes characters that URL percent-encodes on its own', () => {
  expect(parseProxyUrl('http://f o:b"r@0.0.0.0').authorization).toBe('f o:b"r');
});

test('keeps credentials that are not valid percent-encoding as they are', () => {
  expect(parseProxyUrl('http://foo%zz:bar%@0.0.0.0').authorization).toBe('foo%zz:bar%');
});

test('extracts literal IPv6 address', () => {
  expect(parseProxyUrl('http://[2001:db8::1]:3000').hostname).toBe('2001:db8::1');
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
