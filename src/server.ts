import express from "express";
import { createServer, get } from "http";
import { Server } from "socket.io";

import { createGame, deleteGame, getAllGames, getResult, joinGame, lastRoundPick, leaveGame, playCards, startGame, startNewRound, } from "./game/svein";
import { cardsToString } from "./game/deck";

const port = 3000;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    },
});



app.get("/", (req, res) => {
    res.send("Welcome to the Svein game server!");
});

io.on("connection", (socket) => {
    console.log(`A user ${socket.id} connected`);

    socket.emit("game_state", { games: getAllGames() });
    // console.log(JSON.stringify(gameState));


    socket.on("disconnect", () => {
        console.log(`A user ${socket.id} disconnected`);
        try {
            const { gameId } = leaveGame(socket.id);
            console.log(`Player with ID ${socket.id} has left their game.`);

            io.to(gameId).emit("host_playerLeft", { playerId: socket.id });
            socket.leave(gameId);
            io.emit("game_state", { games: getAllGames() });

        } catch (error: any) {
            console.error(`Error leaving game: ${error.message}`);
        }
    });

    socket.on("client_joinGame", (data) => {
        const { gameId, playerName } = data;
        try {
            joinGame(gameId, playerName, socket.id);
            console.log(`Player ${playerName} with ID ${socket.id} joined game ${gameId}`);
            socket.join(gameId);
            socket.emit("client_joinedGame", { gameId, playerName, playerId: socket.id });
            io.to(gameId).emit("host_playerJoined", { playerId: socket.id, playerName });
            io.emit("game_state", { games: getAllGames() });
        } catch (error: any) {

            console.error(`Error joining game: ${error.message}`);
            socket.emit("client_error", { message: error.message });
            socket.leave(data.gameId);
            return;
        }

    });

    socket.on("host_createGame", (data) => {
        const { gameId, maxPlayers, numberOfRounds } = data;
        try {
            createGame(gameId, maxPlayers || 4, numberOfRounds || 10, socket.id);


            console.log(`Game created with ID: ${data?.gameId}`);
            socket.join(data.gameId);
            socket.emit("host_gameCreated", { gameId: data.gameId, maxPlayers, numberOfRounds });
            io.emit("game_state", { games: getAllGames() });

        } catch (error: any) {

            console.error(`Error creating game: ${error.message}`);
            socket.emit("host_error", { message: error.message });
            return;
        }

    });


    socket.on("host_startGame", (data) => {
        console.log(`Game started with ID: ${data?.gameId}`);
        try {
            const { players, nextPlayer, status, round } = startGame(data?.gameId);

            players.forEach(player => {
                socket.to(player.id).emit("client_newRound", { cards: player.cards, savedCards: player.savedCards, round });
            });

            io.to(data?.gameId).emit("gameUpdate", { playerName: null, playedCards: null, nextPlayer: nextPlayer?.name, round, status });

            console.log("Game started successfully", nextPlayer?.name, "is the first player to play.");

            socket.to(nextPlayer?.id || "").emit("client_yourTurn");
            io.emit("game_state", { games: getAllGames() });

        } catch (error: any) {
            console.error(`Error starting game: ${error.message}`);
            socket.emit("host_error", { message: error.message });
            return;
        }
    });

    socket.on("client_playCards", (data) => {
        const { gameId, cards } = data;
        try {
            const playerId = socket.id;
            const { currentPlayer, nextPlayer, isRoundFinished, newCards } = playCards(gameId, playerId, cards);

            socket.emit("client_validCardsPlayed", { newCards });

            // io.to(gameId).emit("host_cardPlayed", { playerName: currentPlayer.name, playedCards: cards });

            if (!isRoundFinished) {
                io.to(gameId).emit("gameUpdate", { playerName: currentPlayer.name, playedCards: cards, nextPlayer: nextPlayer?.name, round: null, status: null });
                socket.to(nextPlayer?.id || "").emit("client_yourTurn");
            } else {
                const { isGameOver, players, nextPlayer, nextRound } = startNewRound(gameId);

                if (isGameOver) {
                    console.log(`Game ${gameId} has finished.`);
                    const { players } = getResult(gameId);

                    players.forEach(player => {
                        console.log(`Player ${player.name ?? player.id} has score: ${player.score}`);
                        io.to(player.id).emit("client_gameFinished", {
                            playerName: player.name,
                            score: player.score,
                        });
                    });

                    io.to(gameId).emit("host_gameFinished", {
                        players: players.map(player => ({
                            name: player.name,
                            score: player.score,
                        }))
                    });
                    deleteGame(gameId);
                    io.emit("game_state", { games: getAllGames() });
                    return;
                }

                if (nextRound === 1) {
                    console.log(`Starting new round 1 for game ${gameId}`);
                    console.log(nextPlayer.lastRoundCards);

                    io.to(gameId).emit("host_round1", { cards: nextPlayer.lastRoundCards });
                    players.forEach(player => {
                        io.to(player.id).emit("client_newRound", { cards: [], savedCards: player.savedCards, round: nextRound });
                    });

                    io.to(nextPlayer?.id || "").emit("client_yourTurn");

                } else {


                    players.forEach(player => {
                        console.log(`Player ${player.name ?? player.id} has cards: ${cardsToString(player.cards)}`);

                        io.to(player.id).emit("client_newRound", { cards: player.cards, savedCards: player.savedCards, round: nextRound });
                        console.log(`Player ${player.name ?? player.id} has saved cards: ${cardsToString(player.savedCards)}`);

                    });

                    io.to(data?.gameId).emit("gameUpdate", { playerName: currentPlayer.name, playedCards: cards, nextPlayer: nextPlayer?.name, round: nextRound, status: null });
                    io.to(nextPlayer?.id || "").emit("client_yourTurn");
                }
            }



        } catch (error: any) {
            console.error(`Error playing card: ${error.message}`);
            socket.emit("client_error", { message: error.message });
        }
    });


    socket.on("client_lastRoundPick", (data) => {
        const { gameId, newCard } = data;
        try {
            const playerId = socket.id;
            const { currentPlayer, nextPlayer, newCards, isRoundFinished } = lastRoundPick(gameId, playerId, newCard);

            console.log(cardsToString(newCards));

            if (isRoundFinished) {

                const { players } = getResult(gameId);
                players.forEach(player => {
                    console.log(`Player ${player.name ?? player.id} has score: ${player.score}`);
                    io.to(player.id).emit("client_gameFinished", {
                        savedCards: player.savedCards,
                        score: player.score,
                        position: player.position,
                    });
                });

                io.to(gameId).emit("host_gameFinished", {
                    players: players.map(player => ({
                        name: player.name,
                        score: player.score,
                        savedCards: player.savedCards,
                        position: player.position,
                    }))
                });

                deleteGame(gameId);
                io.emit("game_state", { games: getAllGames() });




            } else {


                io.to(gameId).emit("gameUpdate", { playerName: currentPlayer.name, playedCards: newCards, nextPlayer: nextPlayer?.name, round: 1 });

                if (nextPlayer.id !== currentPlayer.id) {
                    io.to(currentPlayer.id).emit("client_savedCards", { savedCards: currentPlayer.savedCards });
                }

                io.to(nextPlayer?.id || "").emit("client_yourTurn");
            }



        } catch (error: any) {
            console.error(`Error playing card: ${error.message}`);
            socket.emit("client_error", { message: error.message });
        }


    })


});



httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});