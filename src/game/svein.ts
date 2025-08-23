import { gameState, getCardsByPlayerId, getPlayerById, getPlayerByTurn, goToNextPlayer, IGameRoom } from './state';
import { IPlayer } from './state';
import { cardsToString, cardToString, dealCards, generateDeck, ICard, ranks, shuffleDeck } from './deck';
import { CreateGameError, GameDoesNotExistError, InvalidGameStateError, InvalidMoveError, JoinGameError, PlayerNotFoundError, StartGameError } from './IError';

export const createGame = (gameId: string, maxPlayers: number, numberOfRounds: number) => {
    if (gameState[gameId]) {
        throw new CreateGameError(`Game with ID ${gameId} already exists.`);
    }

    gameState[gameId] = {
        id: gameId,
        players: [],
        maxNumberOfPlayers: maxPlayers,
        status: "waiting",
        totalRounds: numberOfRounds,
        round: numberOfRounds,
        deck: [],
        playedCards: [],
        discardPile: [],
        startingPlayer: 0,
        playerTurn: 0,
        lastPlayedCard: null,
    };
};

export const joinGame = (gameId: string, playerName: string, socketId: string) => {
    const gameRoom = gameState[gameId];

    if (!gameRoom) {
        throw new GameDoesNotExistError(gameId);
    }

    if (gameRoom.players.length >= gameRoom.maxNumberOfPlayers) {
        throw new JoinGameError(`Game with ID ${gameId} is full.`);
    }
    if (playerName.trim() === "") {
        throw new JoinGameError(`Player name cannot be empty.`);
    }

    if (gameRoom.status !== "waiting") {
        throw new JoinGameError(`Game with ID ${gameId} has already started.`);
    }

    if (gameRoom.players.some(p => p.id === socketId)) {
        console.log(
            JSON.stringify(gameRoom.players)
        );

        throw new JoinGameError(`Player is already in the game.`);
    }

    gameRoom.players.push({
        id: socketId,
        name: playerName,
        cards: [],
        savedCards: [],
        lastRoundCards: [],
    });
}

export const startGame = (gameId: string) => {
    const gameRoom = gameState[gameId];
    if (!gameRoom) {
        throw new GameDoesNotExistError(gameId);
    }

    if (gameRoom.players.length < 2) {
        throw new StartGameError(`Not enough players to start the game.`);
    }

    gameRoom.status = "started";

    console.log(`Game with ID ${gameId} has started.`);

    const deck = generateDeck();

    const [hands, remainingDeck] = dealCards(deck, gameRoom.round, gameRoom.players.length);


    gameRoom.players.forEach((player, index) => {
        player.cards = hands[index];
    });

    gameRoom.deck = remainingDeck;
    gameRoom.playedCards = [];
    gameRoom.discardPile = [];
    gameRoom.startingPlayer = Math.floor(Math.random() * gameRoom.players.length);
    gameRoom.playerTurn = gameRoom.startingPlayer;
    gameRoom.lastPlayedCard = null;


    return {
        players: gameRoom.players,
        nextPlayer: getPlayerByTurn(gameRoom),
        status: gameRoom.status,
        round: gameRoom.round,
    };

}

export const playCards = (gameId: string, playerId: string, cards: ICard[]): {
    currentPlayer: IPlayer;
    nextPlayer: IPlayer;
    isRoundFinished: boolean;
    newCards: ICard[];
} => {
    const gameRoom = gameState[gameId];

    if (!gameRoom) {
        throw new GameDoesNotExistError(gameId);
    }

    const player = getPlayerById(gameId, playerId);
    if (!player) {
        throw new PlayerNotFoundError("Player not found in the game.");
    }

    if (getPlayerByTurn(gameRoom)?.id !== player.id) {
        throw new InvalidMoveError(`It's not your turn.`);
    }

    if (!cards.every(card => player.cards.some(c => c.id === card.id))) {
        throw new InvalidMoveError(`You do not have these cards.`);
    }

    switch (cards.length) {
        case 1:
            return playSingleCard(gameRoom, player, cards[0]);
        case 2:
            return playTwoCards(gameRoom, player, cards);
        default:
            throw new InvalidMoveError(`You can only play one or two cards at a time.`);
    }
}

const validateSingleCardPlayed = (gameRoom: IGameRoom, player: IPlayer, card: ICard) => {

    const lastPlayedCard = gameRoom.lastPlayedCard;
    if (!lastPlayedCard) return;

    const sortedPlayerCards = player.cards.sort((a, b) => {
        return ranks.indexOf(a.rank) - ranks.indexOf(b.rank)
    });

    const smallestCard = sortedPlayerCards[0];
    const largestCard = sortedPlayerCards[sortedPlayerCards.length - 1];


    const cardRank = ranks.indexOf(card.rank);
    const lastRank = ranks.indexOf(lastPlayedCard.rank);
    const smallestRank = ranks.indexOf(smallestCard.rank);
    const largestRank = ranks.indexOf(largestCard.rank);

    if (cardRank < lastRank &&
        largestRank >= lastRank) {
        throw new InvalidMoveError(`You must play a higher card than ${lastPlayedCard.rank}.`);
    }

    if (cardRank < lastRank &&
        largestRank < lastRank &&
        cardRank !== smallestRank) {
        throw new InvalidMoveError(`You must play the smallest card`);
    }

}

const playSingleCard = (gameRoom: IGameRoom, player: IPlayer, card: ICard) => {

    validateSingleCardPlayed(gameRoom, player, card);

    // Logic to handle card played
    console.log(`Player ${player.name} played card ${card.rank} of ${card.suit}.`);
    player.cards = player.cards.filter(c => (c.id !== card.id));
    gameRoom.playedCards.push(card);
    gameRoom.lastPlayedCard = card;

    return {
        currentPlayer: player,
        nextPlayer: goToNextPlayer(gameRoom) ?? player,
        isRoundFinished: isRoundFinished(gameRoom),
        newCards: player.cards,
    };
}

const playTwoCards = (gameRoom: IGameRoom, player: IPlayer, cards: ICard[]) => {

    if (cards[0].rank !== cards[1].rank) {
        throw new InvalidMoveError(`You must play two cards of the same rank for a two-for-one.`);
    }

    // Logic to handle two for one play
    console.log(`Player ${player.name} played two for one with cards: ${JSON.stringify(cards)}`);

    // Update game state as needed
    player.cards = player.cards.filter(c => !cards.some(card => card.id === c.id));

    if (gameRoom.deck.length <= 0) reStockPile(gameRoom);

    const newCard = gameRoom.deck.pop();
    console.log(`Player ${player.name} drew a new card: ${JSON.stringify(newCard)}`);

    player.cards.push(newCard!);
    gameRoom.discardPile.push(...cards);

    return {
        currentPlayer: player,
        nextPlayer: goToNextPlayer(gameRoom) ?? player,
        isRoundFinished: isRoundFinished(gameRoom),
        newCards: player.cards,
    };
}

const reStockPile = (gameRoom: IGameRoom) => {
    console.log(`Restocking deck for game ${gameRoom}`);
    const remainingCards = [...gameRoom.deck, ...gameRoom.playedCards, ...gameRoom.discardPile].filter(
        card => card.id !== gameRoom.lastPlayedCard?.id
    );
    if (remainingCards.length === 0) {
        throw new InvalidGameStateError(`No cards left to restock the deck.`);
    }
    gameRoom.deck = shuffleDeck(remainingCards);
    gameRoom.playedCards = [];
    gameRoom.discardPile = [];

    console.log(`Deck restocked for game ${gameRoom}`);
}

const isRoundFinished = (gameRoom: IGameRoom): boolean => {

    if (gameRoom.round >= 2) {
        if (gameRoom.players.every(player => player.cards.length === 1)) {
            console.log(`All players have only one card left.`);
            gameRoom.players.forEach(player => {
                player.savedCards.push(player.cards.pop()!);
                console.log(`Player ${player.name} has saved their last card.`);
            });
            return true;
        }
        return false;
    }
    if (gameRoom.round === 1) {
        return gameRoom.players.every(player => player.savedCards.length === gameRoom.totalRounds);
    } else {
        return true;
    }
}

export const startNewRound = (gameId: string): {
    isGameOver: boolean;
    players: IPlayer[];
    nextPlayer: IPlayer;
    nextRound: number;
} => {

    const gameRoom = gameState[gameId];
    if (!gameRoom) {
        throw new GameDoesNotExistError(gameId);
    }

    prepareNextRound(gameRoom);

    const nextPlayer = getPlayerByTurn(gameRoom);
    if (!nextPlayer) {
        throw new PlayerNotFoundError(`No player found for game ${gameId}.`);
    }


    let isGameOver = false;
    switch (gameRoom.round) {
        case 0:
            console.log(`Game ${gameId} has finished.`);
            isGameOver = true;
            gameRoom.status = "finished";
            break;
        case 1:
            console.log(`Starting last round for game ${gameId}.`);
            nextPlayer.lastRoundCards.push(gameRoom.deck.pop()!);
            break;
        default:
            console.log(`Starting round ${gameRoom.round} for game ${gameId}.`);
            const [hands, remainingDeck] = dealCards(gameRoom.deck, gameRoom.round, gameRoom.players.length);
            gameRoom.deck = remainingDeck;
            gameRoom.players.forEach((player, index) => {
                player.cards = hands[index];
            });
            break;
    }

    return {
        isGameOver,
        players: gameRoom.players,
        nextPlayer,
        nextRound: gameRoom.round
    }
}

const prepareNextRound = (gameRoom: IGameRoom) => {

    gameRoom.players.forEach(player => {
        player.cards = [];
    });
    gameRoom.round -= 1;

    gameRoom.deck = shuffleDeck([...gameRoom.deck, ...gameRoom.playedCards, ...gameRoom.discardPile]);
    gameRoom.playedCards = [];
    gameRoom.discardPile = [];
    gameRoom.lastPlayedCard = null;
    gameRoom.startingPlayer = (gameRoom.startingPlayer + 1) % gameRoom.players.length;
    gameRoom.playerTurn = gameRoom.startingPlayer;
    console.log(`Deck reset for game ${gameRoom.id}.`);

}

export const lastRoundPick = (gameId: string, playerId: string, playerWantsNewCard: boolean) => {
    const gameRoom = gameState[gameId];
    if (!gameRoom) {
        throw new GameDoesNotExistError(gameId);
    }

    const player = getPlayerById(gameId, playerId);
    if (!player) {
        throw new PlayerNotFoundError(`Player with ID ${playerId} is not in the game.`);
    }

    if (getPlayerByTurn(gameRoom)?.id !== player.id) {
        throw new InvalidMoveError(`It's not your turn.`);
    }

    if (player.savedCards.length >= gameRoom.totalRounds) {
        throw new InvalidMoveError(`You have already saved your cards for the last round. you are done picking.`);
    }


    if (player.lastRoundCards.length >= 3) {
        throw new InvalidMoveError(`You have already picked your cards for the last round.`);
    }


    const card = gameRoom.deck.pop();
    if (!card) {
        throw new InvalidGameStateError(`No cards left in the deck.`);
    }


    let nextPlayer;

    if (playerWantsNewCard) {
        player.lastRoundCards.push(card);

        if (player.lastRoundCards.length >= 3) {
            console.log(`Player ${player.name} has finished picking cards for the last round. saves the last card: ${cardToString(card)}`);
            player.savedCards.push(card);
            nextPlayer = goToNextPlayer(gameRoom);
            if (!nextPlayer) {
                throw new PlayerNotFoundError(`No player found for game ${gameId}.`);
            }
            const nextPlayerNewCard = gameRoom.deck.pop();
            if (!nextPlayerNewCard) {
                throw new InvalidGameStateError(`No cards left in the deck for next player.`);
            }
            nextPlayer.lastRoundCards.push(nextPlayerNewCard);

        } else {
            console.log(`Player ${player.name} wants a new card`);
            nextPlayer = player;
        }
    }
    else {
        console.log(`Player ${player.name} has finished picking cards for the last round. saves the last card: ${cardToString(card)}`);
        player.savedCards.push(player.lastRoundCards.pop()!);
        nextPlayer = goToNextPlayer(gameRoom);

        if (!nextPlayer) {
            throw new PlayerNotFoundError(`No player found for game ${gameId}.`);
        }

        nextPlayer.lastRoundCards.push(card);
    }


    return {
        currentPlayer: player,
        nextPlayer,
        isRoundFinished: isRoundFinished(gameRoom),
        newCards: nextPlayer.lastRoundCards,
    }
}



export const getResult = (gameId: string): {
    players: IPlayer[];
} => {
    const gameRoom = gameState[gameId];
    if (!gameRoom) {
        throw new GameDoesNotExistError(gameId);
    }

    gameRoom.players.forEach(player => {
        console.log(`Player ${player.name ?? player.id} has cards: ${cardsToString(player.savedCards)}`);
        player.score = getScore(player);

    });

    gameRoom.players.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    gameRoom.players.forEach((player, index) => {
        player.position = index + 1;
    });


    return {
        players: gameRoom.players,
    }
}


const getScore = (player: IPlayer): number => {
    const rankCounts = player.savedCards.reduce((acc, card) => {
        acc[card.rank] = (acc[card.rank] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const numberOfThreeOfAKind = Object.values(rankCounts).filter(count => count >= 3).length;

    const newCards = [...player.savedCards].sort((a, b) => {
        return ranks.indexOf(b.rank) - ranks.indexOf(a.rank);
    }).slice(numberOfThreeOfAKind);

    return newCards.reduce((acc, card) => {
        return acc + ranks.indexOf(card.rank) + 2;
    }, 0);
}