const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const REPO_PATH = path.resolve(__dirname, "../../");

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

module.exports = {
    resolveCommand,
    validateToken,
    proxyRequest
};
