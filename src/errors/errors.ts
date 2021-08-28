
interface IAutoBuilderError {
    readonly errorCode: Number| undefined;
}
export class AutoBuilderError extends Error implements IAutoBuilderError {
    constructor(message:string, name: string, errorCode?:Number, stack?: string) {
        super(message); 
        this.name = name;
        this.errorCode = errorCode;
        this.stack = stack
      }
    errorCode: Number | undefined;
}

export class InvalidJobError extends  AutoBuilderError{
    constructor(message:string, errorCode?:Number, stack?: string) {
        super(message, "InvalidJobError", errorCode, stack);
      }
  }

export class NetworkError extends  AutoBuilderError{
    constructor(message:string, errorCode?:Number, stack?: string) {
        super(message, "NetworkError", errorCode, stack);
      }
  }

  export class ParserError extends AutoBuilderError {
    constructor(message:string, errorCode?:Number, stack?: string) {
        super(message, "ParserError", errorCode, stack);
      }
  }

  export class PublishError extends AutoBuilderError {
    constructor(message:string, errorCode?:Number, stack?: string) {
        super(message, "PublishError", errorCode, stack);
      }
  }

  export class CDNError extends AutoBuilderError {
    constructor(message:string, errorCode?:Number, stack?: string) {
        super(message, "CDNError", errorCode, stack);
      }
  }

  export class DBError extends AutoBuilderError {
    constructor(message:string, errorCode?:Number, stack?: string) {
        super(message, "DBError", errorCode, stack);
      }
  }