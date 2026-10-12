/** Blume event names and the local payload boundary; c15t owns vendor delivery. */
/** Flat, serializable event properties. */
export type TrackProps = Record<string, boolean | number | string>;
const attempt = (send: () => void): void => {
  try {
    send();
  } catch {
    /* Reporting never breaks UI. */
  }
};

/**
 * @param event The event name.
 * @param props Properties every provider receives.
 * @param local Properties only the `blume:track` CustomEvent carries — free
 *   text a site may bridge to a provider on its own terms, but that must not
 *   reach third parties unasked (a reader's question to the assistant, for instance).
 */
export const track = (
  event: string,
  props: TrackProps,
  local: TrackProps = {}
): void => {
  // Read through `globalThis` so an SSR/import-time call sees `undefined`
  // instead of a bare-identifier ReferenceError.
  const browserWindow = globalThis.window;
  if (browserWindow === undefined) {
    return;
  }
  // SAFETY: The c15t bridge adds this optional callback; optional chaining handles absent runtimes.
  const w = browserWindow as typeof browserWindow & {
    __blumeTrack?: (event: string, props: TrackProps) => void;
  };
  attempt(() => w.__blumeTrack?.(event, props));
  // Universal hook for any other integration.
  attempt(() =>
    w.dispatchEvent(
      new CustomEvent("blume:track", {
        detail: { event, props: { ...props, ...local } },
      })
    )
  );
};
