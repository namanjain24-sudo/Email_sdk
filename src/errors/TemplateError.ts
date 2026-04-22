import { SDKError } from "./SDKError";

export class TemplateError extends SDKError {
  constructor(message: string, correlationId: string) {
    super("TEMPLATE_ERROR", message, correlationId);
    this.name = "TemplateError";
  }
}

