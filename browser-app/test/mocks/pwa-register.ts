/**
 * Mock for virtual:pwa-register
 *
 * This mock provides a stub implementation of the Vite PWA plugin's
 * virtual module for testing purposes.
 */

export type RegisterSWOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
};

/**
 * Mock registerSW function
 * Returns a function that can be called to update the service worker
 */
export function registerSW(_options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  return async (_reloadPage?: boolean) => {
    // Mock implementation - does nothing
  };
}
