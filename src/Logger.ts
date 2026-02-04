export type LogMethod = (context: object | string, message?: string) => void;

export type Logger = {
  child: (context: object) => Logger,
  debug: LogMethod,
  error: LogMethod,
  info: LogMethod,
  trace: LogMethod,
  warn: LogMethod,
};

// oxlint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

const createNoopLogger = (): Logger => {
  return {
    child: () => {
      return createNoopLogger();
    },
    debug: noop,
    error: noop,
    info: noop,
    trace: noop,
    warn: noop,
  };
};

let currentLogger: Logger = createNoopLogger();

export const setLogger = (newLogger: Logger): void => {
  currentLogger = newLogger;
};

const createDelegatingLogger = (getContext: () => object): Logger => {
  const getLogger = () => {
    let targetLogger = currentLogger;
    for (const [key, value] of Object.entries(getContext())) {
      targetLogger = targetLogger.child({[key]: value});
    }

    return targetLogger;
  };

  return {
    child: (context: object) => {
      return createDelegatingLogger(() => {
        return {...getContext(), ...context};
      });
    },
    debug: (context, message) => {
      getLogger().debug(context, message);
    },
    error: (context, message) => {
      getLogger().error(context, message);
    },
    info: (context, message) => {
      getLogger().info(context, message);
    },
    trace: (context, message) => {
      getLogger().trace(context, message);
    },
    warn: (context, message) => {
      getLogger().warn(context, message);
    },
  };
};

export const logger = createDelegatingLogger(() => {
  return {package: 'global-agent'};
});
