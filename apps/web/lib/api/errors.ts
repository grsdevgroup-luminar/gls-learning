import type { ProblemDetail } from "@skillstream/shared";

/** Thrown by the API client on non-2xx responses. Carries the parsed problem
 *  detail so UI can show field/server messages. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetail | null,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Flattened, human-readable message(s) from the problem detail. */
  get displayMessage(): string {
    const m = this.problem?.message;
    if (Array.isArray(m)) return m.join(", ");
    return m ?? this.message;
  }
}

/** Best human-readable message for any error thrown by the API client. */
export function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.displayMessage;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
