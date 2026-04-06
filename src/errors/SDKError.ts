export class SDKError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly correlationId: string
  ) {
    super(message);
    this.name = "SDKError";
  }
}
