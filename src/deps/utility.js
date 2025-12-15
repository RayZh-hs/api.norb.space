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
    try {
        const normalizedTarget =
            typeof target === "string" && target.includes("://")
                ? target
                : `http://${target}`;

        const parsedUrl = new URL(normalizedTarget);

        if (preservePath && activeDomain) {
            const activePath = String(activeDomain).replace(/^\/+/, "");
            if (activePath) {
                const basePath = parsedUrl.pathname || "/";
                parsedUrl.pathname = basePath.endsWith("/")
                    ? `${basePath}${activePath}`
                    : `${basePath}/${activePath}`;
            }
        }

        const incomingSearch = req.url.includes("?")
            ? req.url.substring(req.url.indexOf("?"))
            : "";
        if (!parsedUrl.search && incomingSearch) {
            parsedUrl.search = incomingSearch;
        }

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
    } catch (e) {
        console.error(`Proxy setup error: ${e.message}`);
        if (!res.headersSent) {
            res.status(502).send("Bad Gateway");
        }
    }
}

module.exports = {
    resolveCommand,
    validateToken,
    proxyRequest
};
