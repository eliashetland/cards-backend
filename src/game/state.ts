import { ICard, ranks } from "./deck";

export interface IPlayer {
    id: string;
    name: string;
    cards: ICard[];
    score?: number;
    position?: number;
    savedCards: ICard[]; // Optional property to track saved cards
    lastRoundCards: ICard[]; // Optional property to track cards played in the last round

}

export interface IGameRoom {
    id: string;
    creatorId: string;
    players: IPlayer[];
    maxNumberOfPlayers: number;
    status: "waiting" | "started" | "finished"; // Add more statuses if needed
    round: number;
    totalRounds: number;
    deck: ICard[];
    discardPile: ICard[]; // Add discard pile to track cards that have been played
    playedCards: ICard[];
    playerTurn: number;
    startingPlayer: number;
    lastPlayedCard: ICard | null;
}


interface IGameState {
    [gameId: string]: IGameRoom;
}


export const gameState: IGameState = {};


export const getPlayerByTurn = (gameRoom: IGameRoom): IPlayer | null => {
    if (!gameRoom) return null;
    if (gameRoom.players.length === 0) return null;
    return gameRoom.players[gameRoom.playerTurn % gameRoom.players.length];
}

export const goToNextPlayer = (gameRoom: IGameRoom): IPlayer | null => {
    if (!gameRoom) return null;
    gameRoom.playerTurn = (gameRoom.playerTurn + 1) % gameRoom.players.length;
    return getPlayerByTurn(gameRoom);
}

export const getPlayerById = (gameId: string, playerId: string): IPlayer | undefined => {
    const gameRoom = gameState[gameId];
    if (!gameRoom) return undefined;
    return gameRoom.players.find(player => player.id === playerId);
}

export const getCardsByPlayerId = (gameId: string, playerId: string): ICard[] => {
    const gameRoom = gameState[gameId];
    if (!gameRoom) return [];
    const player = getPlayerById(gameId, playerId);
    const hand = player ? player.cards : [];
    hand.sort((a, b) => {
        // Sort by rank
        return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
    });
    return hand;
}