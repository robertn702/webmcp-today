export {};

// Minimal ambient typing for the page↔extension install bridge. The repo has
// no @types/chrome and bans `as`, so the one surface the bridge uses
// (callback-form sendMessage + lastError) is declared here.
declare global {
  interface WebMcpCafeChromeRuntime {
    lastError?: { message?: string };
    sendMessage(extensionId: string, message: unknown, callback: (response: unknown) => void): void;
  }

  interface Window {
    chrome?: { runtime?: WebMcpCafeChromeRuntime };
  }

  var chrome: { runtime?: WebMcpCafeChromeRuntime } | undefined;
}
