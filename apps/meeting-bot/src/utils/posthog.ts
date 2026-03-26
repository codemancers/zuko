/** No-op PostHog stub — replace with a real PostHog client if analytics are needed. */
export const posthogServer = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  captureException: (..._args: unknown[]) => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  capture: (..._args: unknown[]) => {},
};
