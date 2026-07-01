declare module 'json-schema' {
  export interface JSONSchema7 {
    [key: string]: unknown;
  }
}

declare module 'urijs' {
  export default class URI {
    constructor(...args: unknown[]);
    [key: string]: unknown;
  }
}

type URI = import('urijs').default;
