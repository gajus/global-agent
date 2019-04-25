// @flow

import test from 'ava';
import isUrlMatchingNoProxy from '../../../src/utilities/isUrlMatchingNoProxy';

test('returns `true` if hosts match', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com/', 'foo.com'));
});

test('returns `true` if hosts match (using wildcard)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://bar.foo.com/', '*.foo.com'));
});

test('returns `true` if hosts match (*) and ports match', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8080/', '*:8080'));
});

test('returns `true` if hosts and ports match', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com:8080'));
});

test('returns `false` if host matches and port does not match (diffferent port)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8080/', 'foo.com:8000') === false);
});

test('returns `false` if host matches and port does not match (port not present subject)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com/', 'foo.com:8000') === false);
});

test('returns `false` if host matches and port does not match (port not present NO_PROXY)', (t) => {
  t.assert(isUrlMatchingNoProxy('http://foo.com:8000/', 'foo.com') === false);
});
