const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const REPO_PATH = path.resolve(__dirname, "../../");
const CONFIG_PATH = path.resolve(REPO_PATH, "config.json");

/**
 * Creates an Express middleware function to handle webhook deployments.
 * @param {string} [explicitProjectId] - The project ID to use (e.g., '@' for the self-update route). If not provided, it's read from the URL parameter.
 * @returns {import('express').RequestHandler}
 */
function createUpdateHandler(explicitProjectId) {
  return (req, res) => {
    const projectId = explicitProjectId || req.params.id;

    // 1. Read and parse the configuration file
    let config;
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (error) {
      console.error("Fatal: Could not read or parse config.json.", error);
      return res.status(500).send("Server configuration error.");
    }

    const projectConfig = config.update?.[projectId];
    if (!projectConfig) {
      console.warn(`Webhook received for unknown project ID: ${projectId}`);
      return res.status(404).send("Project configuration not found.");
    }

    // 2. Authenticate the request using a Bearer token
    const authHeader = req.get("Authorization");
    const providedToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    if (!providedToken) {
      return res.status(401).send("Authorization token is required.");
    }

    try {
      const tokensMatch = crypto.timingSafeEqual(
        Buffer.from(providedToken),
        Buffer.from(projectConfig.token)
      );
      if (!tokensMatch) {
        return res.status(403).send("Invalid authorization token.");
      }
    } catch (error) {
      // This catches errors if tokens are different lengths
      return res.status(403).send("Invalid authorization token.");
    }

    // 3. Resolve the command path and execute the script
    let commandPath = projectConfig.command;
    if (commandPath.startsWith("$self/")) {
      repoPath = path.resolve(__dirname, "../../");
      commandPath = path.resolve(repoPath, commandPath.substring(6));
    }

    if (!fs.existsSync(commandPath)) {
      console.error(
        `Script not found for ${projectId} at resolved path: ${commandPath}`
      );
      return res.status(500).send("Deployment script not found on server.");
    }

    console.log(
      `Authenticated request for [${projectId}]. Initiating deployment...`
    );

    execFile(commandPath, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `[${projectId}] Deployment script error: ${error.message}`
        );
        console.error(stderr);
        // The response has already been sent, so we just log the error.
        return;
      }
      if (stderr) {
        console.warn(`[${projectId}] Deployment script stderr: ${stderr}`);
      }
      console.log(`[${projectId}] Deployment script stdout: ${stdout}`);
    });

    // 4. Respond immediately to avoid webhook timeouts
    res.status(202).send(`Deployment for ${projectId} initiated successfully.`);
  };
}

module.exports = createUpdateHandler;
