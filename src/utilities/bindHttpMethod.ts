import http from 'http';
import https from 'https';

type AgentType = http.Agent | https.Agent;

export default (
  originalMethod: Function,
  agent: AgentType,
  forceGlobalAgent: boolean,
) => {
  return (...args: any[]) => {
    let url;
    let options;
    let callback;

    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      url = args[0];

      if (typeof args[1] === 'function') {
        options = {};
        callback = args[1];
      } else {
        options = {
          ...args[1],
        };
        callback = args[2];
      }
    } else {
      options = {
        ...args[0],
      };
      callback = args[1];
    }

    if (forceGlobalAgent) {
      options.agent = agent;
    } else {
      if (!options.agent) {
        options.agent = agent;
      }

      if (options.agent === http.globalAgent || options.agent === https.globalAgent) {
        options.agent = agent;
      }
    }

    if (url) {
      return originalMethod(url, options, callback);
    } else {
      return originalMethod(options, callback);
    }
  };
};
