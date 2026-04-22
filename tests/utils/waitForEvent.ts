export async function waitForEvent<T>(
  emitter: { on: (event: string, handler: (payload: T) => void) => void },
  event: string,
  timeoutMs = 1000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for event '${event}'`));
    }, timeoutMs);

    const handler = (payload: T) => {
      resolve(payload);
    };

    emitter.on(event, handler);

    // Best-effort cleanup when supported; EmailSDK PRD API doesn't require off().
    void timeout;
  });
}

