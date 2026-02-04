import createGlobalThis from 'globalthis';
import {
  logger,
} from '../Logger';
import {
  createGlobalProxyAgent,
} from '../factories';
import type {
  ProxyAgentConfigurationInputType,
} from '../types';

const globalThis: any = createGlobalThis();

const log = logger.child({
  namespace: 'bootstrap',
});

export default (configurationInput?: ProxyAgentConfigurationInputType): boolean => {
  if (globalThis.GLOBAL_AGENT) {
    log.warn('found globalThis.GLOBAL_AGENT; second attempt to bootstrap global-agent was ignored');

    return false;
  }

  globalThis.GLOBAL_AGENT = createGlobalProxyAgent(configurationInput);

  return true;
};
