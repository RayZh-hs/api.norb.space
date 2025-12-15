const { RouteAction, RunAction, DelegateAction, RespondAction } = require("./action");

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
