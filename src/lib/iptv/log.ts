export function iptvLog(scope: string, ...args: unknown[]) {
  console.info(`[vox:${scope}]`, ...args);
}

export function iptvWarn(scope: string, ...args: unknown[]) {
  console.warn(`[vox:${scope}]`, ...args);
}

export function redactUrl(url: string): string {
  return url
    .replace(/password=[^&]*/gi, "password=***")
    .replace(/([?&]u(?:sername)?=)[^&]*/gi, "$1***")
    .replace(/(\/(?:live|movie|series)\/)[^/]+\/[^/]+/gi, "$1***/***");
}
