# deploy

1. ensure node version from `.nvmrc`
1. in monorepo root directory: `yarn && yarn build`
1. follow SSL cert instructions below
1. in this directory: `yarn run`

## One-time setup SSL certs for grpc server

grpc requires an SSL connection or it won't run, so we generate a self-signed certificate:

1. complete CA instructions at: https://connectrpc.com/docs/node/getting-started/#use-the-grpc-protocol-instead-of-the-connect-protocol
1. if those instructions were successful, then mkcert generated `localhost+2.pem` and `localhost+2-key.pem` in this `packages/service` directory which are expected by the grpc server
1. `mkcert` must be in `PATH` and then `yarn run`
