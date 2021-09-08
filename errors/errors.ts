
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

export class JobStoppedError extends  AutoBuilderError{
  constructor(message:string, errorCode?:Number, stack?: string) {
      super(message, "JobStoppedError", errorCode, stack);
    }
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

  export class SurrogateKeyNotFound extends AutoBuilderError {
    url: string;
    constructor(message:string, url:string, errorCode?:Number, stack?: string) {
        super(message, "SurrogateKeyNotFound", errorCode, stack);
        this.url = url;
      }
  }

  export class PurgeBySurrogateKeyFailed extends SurrogateKeyNotFound {
    constructor(message:string, url:string, errorCode?:Number, stack?: string) {
        super(message, url, errorCode, stack);
        this.name = "PurgeBySurrogateKeyFailed";
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

  export class AuthorizationError extends AutoBuilderError {
    constructor(message:string, errorCode?:Number, stack?: string) {
        super(message, "AuthorizationError", errorCode, stack);
      }
  }