export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Used for both "does not exist" and "belongs to someone else", so ids can't be probed. */
export function notFound(what = "Resource"): HttpError {
  return new HttpError(404, `${what} not found`);
}

/** The request is valid but the record is in the wrong state for it. */
export function conflict(message: string): HttpError {
  return new HttpError(409, message);
}
