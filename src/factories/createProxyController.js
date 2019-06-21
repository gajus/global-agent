// @flow

import Events from 'events';
import Logger from '../Logger';

type ProxyControllerType = {|
  eventEmitter: Events | null,
  HTTP_PROXY: string | null,
  HTTPS_PROXY: string | null,
  NO_PROXY: string | null
|};

const log = Logger.child({
  namespace: 'createProxyController'
});

const KNOWN_PROPERTY_NAMES = [
  'eventEmitter',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY'
];

export default (): ProxyControllerType => {
  // eslint-disable-next-line fp/no-proxy
  return new Proxy({
    eventEmitter: null,
    HTTP_PROXY: null,
    HTTPS_PROXY: null,
    NO_PROXY: null
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
