const { error } = require("console");

function Logger(scope = "App") {
  return {
    info: (...args) => console.log(`[INFO] [${scope}]`, ...args),
    warn: (...args) => console.warn(`[WARN] [${scope}]`, ...args),
    error: (...args) => console.error(`[ERROR] [${scope}]`, ...args),
    debug: (...args) => console.debug(`[DEBUG] [${scope}]`, ...args),
  };
}

function LoggerTwo(scope = "Dev") {
  return {
    info: (...args) => console.log(`[info] [${scope}]`, ...args),
    warn: (...args) => console.log(`[warn] [${scope}]`, ...args),
    error: (...args) => console.log(`[error] [${scope}]`, ...args),
  };
}

module.exports = { Logger, LoggerTwo };
