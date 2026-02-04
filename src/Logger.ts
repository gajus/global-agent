export type LogMethod = (context: object | string, message?: string) => void;

export type Logger = {
  child: (context: object) => Logger,
  debug: LogMethod,
  error: LogMethod,
  info: LogMethod,
  trace: LogMethod,
  warn: LogMethod,
};

const createNoopLogger = (): Logger => {
  const noop = () => {};
  return {
    child: () => createNoopLogger(),
    debug: noop,
    error: noop,
    info: noop,
    trace: noop,
    warn: noop,
  };
};

let currentLogger: Logger = createNoopLogger();

export const setLogger = (logger: Logger): void => {
  currentLogger = logger;
};

const createDelegatingLogger = (getContext: () => object): Logger => {
  const getLogger = () => {
    let logger = currentLogger;
    for (const [key, value] of Object.entries(getContext())) {
      logger = logger.child({[key]: value});
    }
    return logger;
  };

  return {
    child: (context: object) => {
      return createDelegatingLogger(() => ({...getContext(), ...context}));
    },
    debug: (context, message) => getLogger().debug(context, message),
    error: (context, message) => getLogger().error(context, message),
    info: (context, message) => getLogger().info(context, message),
    trace: (context, message) => getLogger().trace(context, message),
    warn: (context, message) => getLogger().warn(context, message),
  };
};

export default createDelegatingLogger(() => ({package: 'global-agent'}));
