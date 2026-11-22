export class AppException extends Error {
    constructor(
        message: string,
        public status: number,
        cause?: unknown
    ) {
        super(message, { cause });
        this.name = new.target.name;

    }
}

export class BadRequestException extends AppException {
    constructor(message = "Bad Request", cause?: unknown) {
        super(message, 400, cause);
    }
}

export class NotFoundException extends AppException {
    constructor(message = "Not Found", cause?: unknown) {
        super(message, 404, cause);
    }
}

export class UnauthorizedException extends AppException {
    constructor(message = "Unauthorized", cause?: unknown) {
        super(message, 401, cause);
    }
}

export class ForbiddenException extends AppException {
    constructor(message = "Forbidden", cause?: unknown) {
        super(message, 403, cause);
    }
}

export class ConflictException extends AppException {
    constructor(message = "Conflict", cause?: unknown) {
        super(message, 409, cause);
    }
}

export class InternalServerErrorException extends AppException {
    constructor(message = "Internal Server Error", cause?: unknown) {
        super(message, 500, cause);
    }
}

export class TooManyRequestsException extends AppException {
    constructor(message = "Too Many Requests", cause?: unknown) {
        super(message, 429, cause);
    }
}
