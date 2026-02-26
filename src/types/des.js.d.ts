declare module 'des.js' {
  interface DESOptions {
    type: 'encrypt' | 'decrypt';
    key: number[];
  }

  interface CBCOptions extends DESOptions {
    iv: number[];
  }

  interface DESCipher {
    update(data: number[]): number[];
    final(): number[];
  }

  interface DESConstructor {
    new (options: DESOptions): DESCipher;
  }

  interface CBCFactory {
    instantiate(cipher: DESConstructor): {
      create(options: CBCOptions): DESCipher;
    };
  }

  const DES: DESConstructor;
  const CBC: CBCFactory;
  const EDE: unknown;
  const utils: unknown;
  const Cipher: unknown;

  export { DES, CBC, EDE, utils, Cipher };
}
