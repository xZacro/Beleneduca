import { inspect } from "node:util";

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel() {
  const requestedLevel = String(process.env.FNI_LOG_LEVEL ?? "info").trim().toLowerCase();
  return requestedLevel in LEVEL_PRIORITY ? requestedLevel : "info";
}

function resolveLogFormat() {
  return String(process.env.FNI_LOG_FORMAT ?? "pretty").trim().toLowerCase() === "json"
    ? "json"
    : "pretty";
}

function toSerializableValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializableValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, toSerializableValue(currentValue)])
    );
  }

  return value;
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }

  return toSerializableValue(meta);
}

function shouldLog(level) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[resolveLogLevel()];
}

export function isRequestLoggingEnabled() {
  return String(process.env.FNI_REQUEST_LOG ?? "false").trim().toLowerCase() === "true";
}

export function createLogger(scope) {
  const format = resolveLogFormat();
  const loggerScope = typeof scope === "string" && scope.trim() ? scope.trim() : "app";

  function write(level, message, meta) {
    if (!shouldLog(level)) return;

    const payload = {
      at: new Date().toISOString(),
      level,
      scope: loggerScope,
      message,
      ...normalizeMeta(meta),
    };

    if (format === "json") {
      const line = JSON.stringify(payload);
      if (level === "error") {
        console.error(line);
        return;
      }

      if (level === "warn") {
        console.warn(line);
        return;
      }

      console.log(line);
      return;
    }

    const context =
      Object.keys(payload).length > 4
        ? ` ${inspect(
            Object.fromEntries(
              Object.entries(payload).filter(([key]) => !["at", "level", "scope", "message"].includes(key))
            ),
            {
              breakLength: 120,
              compact: true,
              depth: 5,
              sorted: true,
            }
          )}`
        : "";
    const line = `[${payload.at}] [${level.toUpperCase()}] [${loggerScope}] ${message}${context}`;

    if (level === "error") {
      console.error(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.log(line);
  }

  return {
    debug(message, meta) {
      write("debug", message, meta);
    },
    info(message, meta) {
      write("info", message, meta);
    },
    warn(message, meta) {
      write("warn", message, meta);
    },
    error(message, meta) {
      write("error", message, meta);
    },
  };
}
