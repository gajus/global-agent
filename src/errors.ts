import ExtendableError from 'es6-error';

export class UnexpectedStateError extends ExtendableError {
  public code: string;

  public constructor (message: string, code: string = 'UNEXPECTED_STATE_ERROR') {
    super(message);

    this.code = code;
  }
}
