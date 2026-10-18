// Provider-neutral failure. Providers translate their SDK errors into one of these kinds so that
// aiService (and the rest of the app) never depends on a specific vendor's error classes.
export const PROVIDER_ERROR_KINDS = ['quota', 'unavailable', 'timeout', 'auth', 'bad_request', 'not_found', 'blocked', 'empty', 'network'];

export class ProviderError extends Error {
  constructor(kind, message = kind, status = undefined) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.status = status;
  }
}
