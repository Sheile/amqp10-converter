declare module 'iotagent-node-lib' {
  export interface Config {
    logLevel: string;
    timestamp: boolean;
    contextBroker: {
      host: string;
      port: string;
      ngsiVersion: string;
    };
    deviceRegistry: {
      type: string;
    };
    types: {};
    providerUrl: string;
  }
  export function activate(config: Config, cb: (err: unknown | undefined) => void): void;
  export function setCommandResult(
    entityName: string,
    resource: string,
    apikey: string,
    commandName: string,
    commandResult: unknown,
    status: string,
    deviceInformation: { type: string; id: string; service: string; subservice: string; commands: unknown},
    callback: () => void,
  ): void;
  export function deactivate(cb: (err: unknown | undefined) => void): void;
}