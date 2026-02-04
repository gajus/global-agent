import type {
  Agent as HttpAgent,
} from 'http';
import type {
  Agent as HttpsAgent,
} from 'https';
import type {
  Socket,
} from 'net';
import type {
  TLSSocket,
} from 'tls';
import type {
  Logger,
} from './Logger';

export type ProxyConfigurationType = {
  authorization: string | null,
  hostname: string,
  port: number,
};

export type TlsConfigurationType = {
  ca?: string[] | string,
  cert?: string,
  ciphers?: string,
  clientCertEngine?: string,
  crl?: string,
  dhparam?: string,
  ecdhCurve?: string,
  honorCipherOrder?: boolean,
  key?: string,
  passphrase?: string,
  pfx?: string,
  rejectUnauthorized?: boolean,
  secureOptions?: number,
  secureProtocol?: string,
  servername?: string,
  sessionIdContext?: string,
};

export type ConnectionConfigurationType = {
  host: string,
  port: number,
  tls?: TlsConfigurationType,
  proxy: ProxyConfigurationType,
};

export type ConnectionCallbackType = (error: Error | null, socket?: Socket | TLSSocket) => void;

export type AgentType = HttpAgent | HttpsAgent;
export type IsProxyConfiguredMethodType = () => boolean;
export type MustUrlUseProxyMethodType = (url: string) => boolean;
export type GetUrlProxyMethodType = (url: string) => ProxyConfigurationType;
export type ProtocolType = 'http:' | 'https:';

export type ProxyAgentConfigurationInputType = {
  environmentVariableNamespace?: string,
  forceGlobalAgent?: boolean,
  socketConnectionTimeout?: number,
  ca?: string[] | string,
  logger?: Logger,
};

export type ProxyAgentConfigurationType = {
  environmentVariableNamespace: string,
  forceGlobalAgent: boolean,
  socketConnectionTimeout: number,
  ca?: string[] | string,
};
