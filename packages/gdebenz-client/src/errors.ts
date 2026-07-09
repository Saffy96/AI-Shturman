export class GdebenzClientError extends Error {
  readonly statusCode?: number;
  readonly isTimeout: boolean;

  constructor(message: string, options: { statusCode?: number; isTimeout?: boolean; cause?: unknown } = {}) {
    super(message);
    this.name = "GdebenzClientError";
    this.statusCode = options.statusCode;
    this.isTimeout = options.isTimeout ?? false;

    if (options.cause) {
      this.cause = options.cause;
    }
  }
}
