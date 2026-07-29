export {};

// Minimal ambient typing for the page↔extension install bridge. The repo has
// no @types/chrome and bans `as`, so the one surface the bridge uses
// (callback-form sendMessage + lastError) is declared here.
declare global {
  interface WebMcpTodayChromeRuntime {
    lastError?: { message?: string };
    sendMessage(extensionId: string, message: unknown, callback: (response: unknown) => void): void;
  }

  interface Window {
    chrome?: { runtime?: WebMcpTodayChromeRuntime };
  }

  var chrome: { runtime?: WebMcpTodayChromeRuntime } | undefined;
}
