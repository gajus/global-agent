// @flow

import test from 'ava';
import isUrlMatchingNoProxy from '../../../src/utilities/isUrlMatchingNoProxy';

test('returns `true` if hosts match', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com/', 'foo.com'));
});

test('returns `true` if hosts match (IP)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://127.0.0.1/', '127.0.0.1'));
});

test('returns `true` if hosts match (using asterisk wildcard)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://bar.foo.com/', '*.foo.com'));
});

test('returns `true` if domain matches (using dot wildcard)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com/', '.foo.com'));
});

test('returns `true` if subdomain matches (using dot wildcard)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://bar.foo.com/', '.foo.com'));
});

test('returns `true` if hosts match (*) and ports match', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8080/', '*:8080'));
});

test('returns `true` if hosts and ports match', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com:8080'));
});

test('returns `true` if hosts match and NO_PROXY does not define port', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com'));
});

test('returns `true` if hosts (IP) and ports match', (t) => {
  t.assert(isUrlMatchingNoProxy('http://127.0.0.1:8080/', '127.0.0.1:8080'));
});

test('returns `false` if hosts match and ports do not match (diffferent port)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com:8000') === false);
});

test('returns `false` if hosts match and ports do not match (port not present subject)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com/', 'foo.com:8000') === false);
});

test('returns `true` if hosts match and ports do not match (port not present NO_PROXY)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8000/', 'foo.com'));
});

test('returns `true` if hosts match in one of multiple rules', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com/', 'bar.org,foo.com,baz.io'));
});
