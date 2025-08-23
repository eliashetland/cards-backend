import { randomUUID } from "crypto";


export interface ICard {
    suit: string;
    rank: string;
    id: string;
}

export const cardToString = (card: ICard): string => {
    const suitsString = ["♥", "♦", "♣", "♠"];
    return `${card.rank}${suitsString[suits.indexOf(card.suit)]}`;
};

export const cardsToString = (cards: ICard[]): string => {
    return cards.map(card => cardToString(card)).join(", ");
};

export const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];

export const generateDeck = (): ICard[] => {

    const deck: ICard[] = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank, id: randomUUID() });
        }
    }
    return deck;
};


export const shuffleDeck = (deck: ICard[]): ICard[] => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};
export const dealCards = (deck: ICard[], cardsPerPlayer: number, numberOfPlayers: number): [ICard[][], ICard[]] => {
    const shuffledDeck: ICard[] = shuffleDeck(deck);
    const hands: ICard[][] = Array.from({ length: numberOfPlayers }, () => []);

    for (const hand of hands) {
        for (let i = 0; i < cardsPerPlayer; i++) {
            if (shuffledDeck.length > 0) {
                const card = shuffledDeck.pop();
                if (card) hand.push(card);
                else {
                    console.warn("Deck ran out of cards while dealing.");
                    break;
                }
            }
        }

        hand.sort((a, b) => {
            // Sort by rank
            return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
        });
    }

    return [hands, shuffledDeck];
}


