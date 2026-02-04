import {
  expect,
  test,
} from 'vitest';
import isUrlMatchingNoProxy from './isUrlMatchingNoProxy';

test('returns `true` if hosts match', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', 'foo.com')).toBe(true);
});

test('returns `true` if hosts match (IP)', () => {
  expect(isUrlMatchingNoProxy('http://127.0.0.1/', '127.0.0.1')).toBe(true);
});

test('returns `true` if hosts match (using asterisk wildcard)', () => {
  expect(isUrlMatchingNoProxy('http://bar.foo.com/', '*.foo.com')).toBe(true);
});

test('returns `true` if domain matches (using dot wildcard)', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', '.foo.com')).toBe(true);
});

test('returns `true` if subdomain matches (using dot wildcard)', () => {
  expect(isUrlMatchingNoProxy('http://bar.foo.com/', '.foo.com')).toBe(true);
});

test('returns `true` if hosts match (*) and ports match', () => {
  expect(isUrlMatchingNoProxy('http://foo.com:8080/', '*:8080')).toBe(true);
});

test('returns `true` if hosts and ports match', () => {
  expect(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com:8080')).toBe(true);
});

test('returns `true` if hosts match and NO_PROXY does not define port', () => {
  expect(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com')).toBe(true);
});

test('returns `true` if hosts (IP) and ports match', () => {
  expect(isUrlMatchingNoProxy('http://127.0.0.1:8080/', '127.0.0.1:8080')).toBe(true);
});

test('returns `false` if hosts match and ports do not match (diffferent port)', () => {
  expect(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com:8000')).toBe(false);
});

test('returns `false` if hosts match and ports do not match (port not present subject)', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', 'foo.com:8000')).toBe(false);
});

test('returns `true` if hosts match and ports do not match (port not present NO_PROXY)', () => {
  expect(isUrlMatchingNoProxy('http://foo.com:8000/', 'foo.com')).toBe(true);
});

test('returns `true` if hosts match in one of multiple rules separated with a comma', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', 'bar.org,foo.com,baz.io')).toBe(true);
});

test('returns `true` if hosts match in one of multiple rules separated with a comma and a space', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', 'bar.org, foo.com, baz.io')).toBe(true);
});

test('returns `true` if hosts match in one of multiple rules separated with a space', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', 'bar.org foo.com baz.io')).toBe(true);
});

test('handles trailing newline in NO_PROXY', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', 'foo.com\n')).toBe(true);
});

test('handles trailing whitespace in NO_PROXY', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', 'foo.com   ')).toBe(true);
});

test('handles leading whitespace in NO_PROXY', () => {
  expect(isUrlMatchingNoProxy('http://foo.com/', '  foo.com')).toBe(true);
});
