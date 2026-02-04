export class UnexpectedStateError extends Error {
  public code: string;

  public constructor (message: string, code: string = 'UNEXPECTED_STATE_ERROR') {
    super(message);

    this.code = code;
  }
}
