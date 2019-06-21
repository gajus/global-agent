// @flow

import Logger from '../Logger';

const log = Logger.child({
  namespace: 'bootstrap'
});

const KNOWN_PROPERTY_NAMES = [
  'bootstrapped',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY'
];

export default () => {
  // eslint-disable-next-line fp/no-proxy
  return new Proxy({
    bootstrapped: false,
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    NO_PROXY: ''
  }, {
    set: (subject, name, value) => {
      if (!KNOWN_PROPERTY_NAMES.includes(name)) {
        throw new Error('Cannot set an unmapped property "' + name + '".');
      }

      subject[name] = value;

      log.info({
        change: {
          name,
          value
        },
        newConfiguration: subject
      }, 'configuration changed');

      return true;
    }
  });
};
