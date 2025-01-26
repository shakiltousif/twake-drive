export class FileNotFountException extends Error {
  constructor(readonly path: string, details: string) {
    super(details);
  }
}
export class WriteFileException extends Error {
  constructor(readonly path: string, details: string) {
    super(details);
  }
}
