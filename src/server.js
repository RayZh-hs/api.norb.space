const express = require("express");
const fs = require("fs");
const path = require("path");
const JSON5 = require("json5");
const { parseArgs } = require("util");
const { buildActionTree } = require("./deps/runner");
const requestLogger = require("./deps/logger");

const app = express();

const { values } = parseArgs({
    options: {
        port: {
            type: "string",
            short: "p",
            default: "25820",
        },
        config: {
            type: "string",
            short: "c",
            default: path.resolve(__dirname, "../config.json"),
        },
    },
});

const port = parseInt(values.port, 10);
const configPath = path.resolve(values.config);

app.use(express.json());
app.use(requestLogger);

// Load config
let rootAction;
try {
    const config = JSON5.parse(fs.readFileSync(configPath, "utf8"));
    rootAction = buildActionTree(config);
} catch (error) {
    console.error("Fatal: Could not read or parse config.json.", error);
    process.exit(1);
}

// Main entry point for all requests
app.all(/.*/, (req, res) => {
    console.log(`Received request: ${req.method} ${req.path}`);
    const activeDomain = req.path.startsWith("/") ? req.path.substring(1) : req.path;    
    rootAction.run(req, res, activeDomain);
});

app.listen(port, () => {
  console.info(`API Hub server is running on http://localhost:${port}`);
});