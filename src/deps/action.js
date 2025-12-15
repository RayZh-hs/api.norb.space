const { execFile } = require("child_process");
const { resolveCommand, validateToken, proxyRequest } = require("./utility");

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
        
        // Lazy load to avoid circular dependency issues
        const { buildActionTree } = require("./runner");

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
            const nextActiveDomain =
                !this.useRegex && matchedRoute.key === "*"
                    ? domainToMatch
                    : parts.slice(1).join("/");
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

module.exports = {
    Action,
    RouteAction,
    RunAction,
    DelegateAction,
    RespondAction
};
