import { IPlayer } from "./state";

export class CreateGameError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CreateGameError';
    }
}

export class StartGameError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StartGameError';
    }
}

export class JoinGameError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JoinGameError';
    }
}
export class GameDoesNotExistError extends Error {
    constructor(gameId: string) {
        super(`Game with ID ${gameId} does not exist.`);
        this.name = 'GameDoesNotExistError';
    }
}

export class PlayerNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PlayerNotFoundError';
    }
}

export class InvalidMoveError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidMoveError';
    }
}

export class InvalidGameStateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidGameStateError';
    }
}

export class InvalidCardError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidCardError';
    }
}
