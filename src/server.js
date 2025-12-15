const express = require("express");
const fs = require("fs");
const path = require("path");
const JSON5 = require("json5");
const { runAction } = require("./action-runner");

const app = express();
const port = 25820;
const CONFIG_PATH = path.resolve(__dirname, "../config.json");

app.use(express.json());

// Load config
let config;
try {
    config = JSON5.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
} catch (error) {
    console.error("Fatal: Could not read or parse config.json.", error);
    process.exit(1);
}

// Main entry point for all requests
app.all(/.*/, (req, res) => {
    console.log(`Received request: ${req.method} ${req.path}`);
    const activeDomain = req.path.startsWith("/") ? req.path.substring(1) : req.path;    
    runAction(config, req, res, activeDomain);
});

app.listen(port, () => {
  console.info(`API Hub server is running on http://localhost:${port}`);
});