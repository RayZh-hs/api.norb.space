const { execFile } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const REPO_PATH = path.resolve(__dirname, "../");

/**
 * Resolves the command path, handling $self variable.
 * @param {string} command
 * @returns {string}
 */
function resolveCommand(command) {
    if (command.startsWith("$self/")) {
        return path.resolve(REPO_PATH, command.substring(6));
    }
    return command;
}

/**
 * Validates the token if provided in the action config.
 * @param {object} req
 * @param {string} token
 * @returns {boolean}
 */
function validateToken(req, token) {
    if (!token) return true;
    const authHeader = req.get("Authorization");
    const providedToken = authHeader?.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!providedToken) return false;

    try {
        return crypto.timingSafeEqual(
            Buffer.from(providedToken),
            Buffer.from(token)
        );
    } catch (e) {
        return false;
    }
}

/**
 * Proxies the request to the target URL.
 * @param {object} req
 * @param {object} res
 * @param {string} target
 * @param {boolean} preservePath
 * @param {string} activeDomain
 */
function proxyRequest(req, res, target, preservePath, activeDomain) {
    let targetUrl = target;
    if (preservePath && activeDomain) {
        if (!targetUrl.endsWith("/")) targetUrl += "/";
        targetUrl += activeDomain;
    }

    const parsedUrl = new URL(targetUrl);
    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: req.method,
        headers: { ...req.headers, host: parsedUrl.host },
    };

    const requestModule = parsedUrl.protocol === "https:" ? https : http;

    const proxyReq = requestModule.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on("error", (e) => {
        console.error(`Proxy error: ${e.message}`);
        if (!res.headersSent) {
            res.status(502).send("Bad Gateway");
        }
    });

    req.pipe(proxyReq);
}

/**
 * Runs the action tree.
 * @param {object} action
 * @param {object} req
 * @param {object} res
 * @param {string} activeDomain
 */
async function runAction(action, req, res, activeDomain) {
    if (!action) {
        return res.status(404).send("Action not found");
    }

    const actionType = action.action;

    if (actionType === "route") {
        const routes = action.routes || {};
        const useRegex = action.use_regex || false;

        // Remove leading slash for matching
        const domainToMatch = activeDomain.startsWith("/") ? activeDomain.substring(1) : activeDomain;
        
        const parts = domainToMatch.split("/");
        const firstSegment = parts[0];

        const keys = Object.keys(routes);
        const matchedKey = keys.find((key) => {
            if (useRegex) {
                try {
                    return new RegExp(key).test(firstSegment);
                } catch (e) {
                    console.error(`Invalid regex in route key: ${key}`, e);
                    return false; // ignore invalid regex
                }
            }
            if (key === "*") return true;
            if (key === "@") return firstSegment === "";
            return key === firstSegment;
        });

        if (matchedKey) {
            const nextActiveDomain = parts.slice(1).join("/");
            return runAction(routes[matchedKey], req, res, nextActiveDomain);
        } else {
            return res.status(404).send("No matching route found.");
        }

    } else if (actionType === "run") {
        if (action.token) {
            if (!validateToken(req, action.token)) {
                return res.status(403).send("Unauthorized");
            }
        }

        const command = resolveCommand(action.command);
        const args = action.args || [];

        console.log(`Executing command: ${command} ${args.join(" ")}`);

        execFile(command, args, (error, stdout, stderr) => {
            if (error) {
                console.error(`Command error: ${error.message}`);
                console.error(stderr);
                // If we haven't sent a response yet (we shouldn't have)
                return res.status(500).send(`Command failed: ${error.message}`);
            }
            
            res.status(200).send(stdout);
        });

    } else if (actionType === "delegate") {
        const target = action.target;
        const preservePath = action.preserve_path !== false; // Default true
        proxyRequest(req, res, target, preservePath, activeDomain);

    } else if (actionType === "respond") {
        const status = action.status || 200;
        const headers = action.headers || {};
        const body = action.body || "";

        res.status(status);
        for (const [key, value] of Object.entries(headers)) {
            res.set(key, value);
        }
        res.send(body);

    } else {
        res.status(500).send(`Unknown action type: ${actionType}`);
    }
}

module.exports = { runAction };
