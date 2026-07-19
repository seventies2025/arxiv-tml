import { createServer } from "node:http";
import { config } from "./config.mjs";
import { handleRequest } from "./handler.mjs";

const server = createServer(handleRequest);

server.listen(config.port, config.host, () => {
  console.log(`arXiv-TML server running at http://${config.host}:${config.port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});