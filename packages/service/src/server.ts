import { isProduction } from "@3cities/core";
import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";
import { fastify } from "fastify";
import { readFileSync } from "fs";
import routes from "./connect";

// TODO consider separating the grpc service API from the actual long-running backend service proccess... eg. @3cities/service-core vs. @3cities/grpc-service --> in future, service-core could run eg. on cloudflare webworker

async function main() {
  const port: number | undefined = (() => {
    const p = process.env['PORT'];
    if (p) {
      const p2 = parseInt(p);
      if (isNaN(p2)) return undefined;
      else return p2;
    } else return undefined;
  })();
  console.log("@3cities/service environment", {
    isProduction,
    port,
  })
  const server = fastify({
    http2: true,
    https: {
      key: readFileSync("localhost+2-key.pem", "utf8"),
      cert: readFileSync("localhost+2.pem", "utf8"),
    }
  });
  await server.register(fastifyConnectPlugin, {
    routes,
  });
  await server.listen({ host: "localhost", port: port || 8443 }); // WARNING requires env var NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" https://connectrpc.com/docs/node/getting-started/#use-the-grpc-protocol-instead-of-the-connect-protocol
  console.log("server is listening at", server.addresses());
}
void main();
