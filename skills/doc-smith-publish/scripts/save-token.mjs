#!/usr/bin/env node
// Usage: node save-token.mjs --token <token> [--hub <hub-url>]
// Saves the access credential to ~/.aigne/docsmith-connected.yaml

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    token: { type: "string" },
    hub: { type: "string", default: "https://docsmith.aigne.io" },
  },
});

if (!values.token) {
  console.error("Usage: node save-token.mjs --token <token> [--hub <hub-url>]");
  process.exit(1);
}

const { createStore } = await import("./utils/store.mjs");
const { hostname } = new URL(values.hub);
const store = await createStore();
await store.setItem(hostname, { DOCSMITH_ACCESS_TOKEN: values.token });
console.log(`Credential saved for ${hostname}`);
