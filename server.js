const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" } // Allows your GitHub website to connect
});

let rooms = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. Join a Room
    socket.on('joinRoom', ({ roomId, username }) => {
        socket.join(roomId);
        
        if (!rooms[roomId]) {
            rooms[roomId] = {
                id: roomId,
                players: [],
                gameStarted: false,
                rounds: [],
                currentRound: 0
            };
        }

        const room = rooms[roomId];
        
        if (!room.gameStarted) {
            room.players.push({ id: socket.id, username, choice: null });
            io.to(roomId).emit('updatePlayers', room.players);
        } else {
            socket.emit('error', 'Game already started!');
        }
    });

    // 2. Host Starts Game
    socket.on('startGame', (roomId) => {
        if (rooms[roomId]) {
            rooms[roomId].gameStarted = true;
            io.to(roomId).emit('gameStarted');
        }
    });

    // 3. Handle Submitted Prompts or Drawings
    socket.on('submitTurn', ({ roomId, type, value }) => {
        const room = rooms[roomId];
        if (!room) return;

        // Find player and save their input
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.choice = { type, value };
        }

        // Check if everyone is done
        const allDone = room.players.every(p => p.choice !== null);
        if (allDone) {
            // Handle phase rotation logic here for an advanced setup
            // For this basic version, we instantly send data to pass around
            io.to(roomId).emit('nextPhase', room.players);
            
            // Reset choices for the next turn
            room.players.forEach(p => p.choice = null);
        }
    });

    socket.on('disconnect', () => {
        // Clean up empty rooms on disconnect
        for (let roomId in rooms) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
            } else {
                io.to(roomId).emit('updatePlayers', rooms[roomId].players);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));