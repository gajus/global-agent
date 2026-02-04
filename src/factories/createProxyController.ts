import {
  logger,
} from '../Logger';

type ProxyController = {
  HTTP_PROXY: string | null,
  HTTPS_PROXY: string | null,
  NO_PROXY: string | null,
};

const log = logger.child({
  namespace: 'createProxyController',
});

const KNOWN_PROPERTY_NAMES = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
];

export default (): ProxyController => {
  // oxlint-disable-next-line fp/no-proxy
  return new Proxy({
    HTTP_PROXY: null,
    HTTPS_PROXY: null,
    NO_PROXY: null,
  }, {
    set: (subject, name, value) => {
      if (typeof name !== 'string') {
        throw new TypeError('Unexpected object member.');
      }

      if (!KNOWN_PROPERTY_NAMES.includes(name)) {
        throw new Error('Cannot set an unmapped property "' + name + '".');
      }

      // @ts-expect-error string cannot be used to index an object
      subject[name] = value;

      log.info({
        change: {
          name,
          value,
        },
        newConfiguration: subject,
      }, 'configuration changed');

      return true;
    },
  });
};
