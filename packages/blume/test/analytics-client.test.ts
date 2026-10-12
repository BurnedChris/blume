import { afterEach, expect, it, mock } from "bun:test";

import { track } from "../src/components/layout/analytics-client.ts";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});
it("is safe before a browser runtime exists", () => {
  expect(() => track("search", {})).not.toThrow();
});
it("sends only public metadata through c15t and keeps free text local", () => {
  const send = mock();
  const dispatch = mock();
  Reflect.set(globalThis, "window", {
    __blumeTrack: send,
    dispatchEvent: dispatch,
  });
  track("search", { length: 5 }, { query: "private question" });
  expect(send).toHaveBeenCalledWith("search", { length: 5 });
  expect(dispatch.mock.calls[0]?.[0].detail).toEqual({
    event: "search",
    props: { length: 5, query: "private question" },
  });
});
it("preserves the local event if a vendor fails or the runtime is absent", () => {
  const dispatch = mock();
  Reflect.set(globalThis, "window", {
    __blumeTrack: () => {
      throw new Error("failed");
    },
    dispatchEvent: dispatch,
  });
  expect(() => track("search", {})).not.toThrow();
  expect(dispatch).toHaveBeenCalledTimes(1);
  Reflect.set(globalThis, "window", { dispatchEvent: dispatch });
  track("search", {});
  expect(dispatch).toHaveBeenCalledTimes(2);
});
