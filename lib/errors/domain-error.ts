export class DomainError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly statusCode = 400,
  ) {
    super(publicMessage);
    this.name = "DomainError";
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = "Necesitas iniciar sesion.") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = "No tienes permiso para realizar esta accion.") {
    super(message, 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Recurso no encontrado.") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
