const { execFile } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const REPO_PATH = path.resolve(__dirname, "../");

function resolveCommand(command) {
    if (command.startsWith("$self/")) {
        return path.resolve(REPO_PATH, command.substring(6));
    }
    return command;
}

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

class Action {
    constructor(config) {
        this.config = config;
    }

    async run(req, res, activeDomain) {
        throw new Error("Not implemented");
    }
}

class RouteAction extends Action {
    constructor(config) {
        super(config);
        this.useRegex = config.use_regex || false;
        this.routes = [];
        
        if (config.routes) {
            for (const [key, childConfig] of Object.entries(config.routes)) {
                let regex = null;
                if (this.useRegex) {
                    try {
                        regex = new RegExp(key);
                    } catch (e) {
                        throw new Error(`Invalid regex in route key: ${key}`);
                    }
                }
                this.routes.push({
                    key,
                    regex,
                    action: buildActionTree(childConfig)
                });
            }
        }
    }

    async run(req, res, activeDomain) {
        const domainToMatch = activeDomain.startsWith("/") ? activeDomain.substring(1) : activeDomain;
        const parts = domainToMatch.split("/");
        const firstSegment = parts[0];

        const matchedRoute = this.routes.find(route => {
            if (this.useRegex) {
                return route.regex.test(firstSegment);
            }
            if (route.key === "*") return true;
            if (route.key === "@") return firstSegment === "";
            return route.key === firstSegment;
        });

        if (matchedRoute) {
            const nextActiveDomain = parts.slice(1).join("/");
            return matchedRoute.action.run(req, res, nextActiveDomain);
        } else {
            return res.status(404).send("No matching route found.");
        }
    }
}

class RunAction extends Action {
    constructor(config) {
        super(config);
        this.token = config.token;
        this.command = resolveCommand(config.command);
        this.args = config.args || [];
    }

    async run(req, res, activeDomain) {
        if (this.token) {
            if (!validateToken(req, this.token)) {
                return res.status(403).send("Unauthorized");
            }
        }

        console.log(`Executing command: ${this.command} ${this.args.join(" ")}`);

        execFile(this.command, this.args, (error, stdout, stderr) => {
            if (error) {
                console.error(`Command error: ${error.message}`);
                console.error(stderr);
                return res.status(500).send(`Command failed: ${error.message}`);
            }
            res.status(200).send(stdout);
        });
    }
}

class DelegateAction extends Action {
    constructor(config) {
        super(config);
        this.target = config.target;
        this.preservePath = config.preserve_path !== false;
    }

    async run(req, res, activeDomain) {
        proxyRequest(req, res, this.target, this.preservePath, activeDomain);
    }
}

class RespondAction extends Action {
    constructor(config) {
        super(config);
        this.status = config.status || 200;
        this.headers = config.headers || {};
        this.body = config.body || "";
    }

    async run(req, res, activeDomain) {
        res.status(this.status);
        for (const [key, value] of Object.entries(this.headers)) {
            res.set(key, value);
        }
        res.send(this.body);
    }
}

function buildActionTree(config) {
    if (!config || !config.action) {
        throw new Error("Invalid configuration: missing action type");
    }

    switch (config.action) {
        case "route":
            return new RouteAction(config);
        case "run":
            return new RunAction(config);
        case "delegate":
            return new DelegateAction(config);
        case "respond":
            return new RespondAction(config);
        default:
            throw new Error(`Unknown action type: ${config.action}`);
    }
}

module.exports = { buildActionTree };
