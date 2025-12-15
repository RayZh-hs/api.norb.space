const fs = require("fs");
const path = require("path");
const os = require("os");

const timestamp = () => {
    return new Date().toISOString().replace(/[:.]/g, "-");
}
const logDir = path.resolve(__dirname, "../../logs");
const logFile = path.join(logDir, `${timestamp()}.log`);

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const requestLogger = (req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();
    const { method, path: reqPath, ip, body } = req;
    const userIp = ip || req.connection.remoteAddress;

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logEntry = `[${timestamp}] IP: ${userIp} | METHOD: ${method} | PATH: ${reqPath} | DURATION: ${duration}ms | BODY: ${JSON.stringify(body)}\n`;
        
        fs.appendFile(logFile, logEntry, (err) => {
            if (err) console.error("Failed to write to log file:", err);
        });
    });

    next();
};

module.exports = requestLogger;
