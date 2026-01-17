declare module 'node-jose' {
    export namespace JWK {
        interface KeyStore {
            get(kid: string): Promise<Key>;
            all(opts?: object): Promise<Key[]>;
        }
        interface Key {
            kid: string;
            kty: string;
            thumbprint(hash: string): Promise<string>;
        }
        function asKeyStore(jwks: object | string): Promise<KeyStore>;
        function createKeyStore(): KeyStore;
    }

    export namespace JWS {
        interface VerifyResult {
            header: object;
            payload: Buffer;
            key: JWK.Key;
            protected: object;
        }
        interface Verifier {
            verify(input: string): Promise<VerifyResult>;
        }
        function createVerify(keystore: JWK.KeyStore): Verifier;
    }
}
