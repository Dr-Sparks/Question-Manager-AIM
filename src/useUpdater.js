// React hook over window.aim (preload bridge). All state and side-effects
// related to the auto-updater live here so the UI components stay declarative.
//
// State shape mirrors the events from electron-updater:
//   state:    'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
//   info?:    { version, releaseNotes?, releaseName?, releaseDate? }
//   progress?:{ percent, transferred, total, bytesPerSecond }
//   error?:   { message }

import { useEffect, useState, useCallback, useRef } from "react";

const NOOP_API = {
  platform: "unknown",
  getAppVersion: async () => "dev",
  onUpdateStatus: () => () => {},
  checkForUpdates: async () => {},
  quitAndInstall: async () => {},
  openDownloadUrl: async () => false,
};

function getApi() {
  return (typeof window !== "undefined" && window.aim) || NOOP_API;
}

export function useUpdater() {
  const [status, setStatus] = useState({ state: "idle" });
  const [version, setVersion] = useState("");
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    try {
      return window.localStorage.getItem("aim_update_dismissed") || "";
    } catch {
      return "";
    }
  });

  // Track latest state in a ref so callbacks don't go stale
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const api = getApi();
    api.getAppVersion().then(setVersion).catch(() => setVersion(""));
    const unsubscribe = api.onUpdateStatus((payload) => {
      if (payload && typeof payload === "object") {
        setStatus(payload);
      }
    });
    return () => {
      try {
        unsubscribe?.();
      } catch {
        /* noop */
      }
    };
  }, []);

  const checkForUpdates = useCallback(() => getApi().checkForUpdates(), []);
  const installNow = useCallback(() => getApi().quitAndInstall(), []);
  const openDownload = useCallback(() => getApi().openDownloadUrl(), []);

  const dismiss = useCallback(() => {
    const v = statusRef.current?.info?.version;
    if (v) {
      try {
        window.localStorage.setItem("aim_update_dismissed", v);
      } catch {
        /* noop */
      }
      setDismissedVersion(v);
    }
  }, []);

  const offeredVersion = status?.info?.version || "";
  const isDismissed =
    offeredVersion && offeredVersion === dismissedVersion;

  return {
    status,
    version,
    platform: getApi().platform,
    isDismissed,
    checkForUpdates,
    installNow,
    openDownload,
    dismiss,
  };
}
