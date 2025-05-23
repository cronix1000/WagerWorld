// server.js
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server, matchMaker } = require('@colyseus/core');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { MyRoom } = require('./rooms/MyRoom');
const { CardRoom } = require('./rooms/CardRoom');
const { BlackjackRoom } = require('./rooms/BlackjackRoom');
const { admin, firestore, auth } = require('./firebase'); 
const HorseRacingRoom = require('./rooms/HorseBettingRoom');
const { RouletteRoom } = require('./rooms/RouletteRoom');
const { PokerRoom } = require('./rooms/PokerRoom');
const { BaccaratRoom } = require("./rooms/BaccaratRoom");
const { Lobby } = require('./rooms/Lobby');
const endpoints = require('./endpoints');

const app = express();
const port = process.env.PORT || 2567;
// NOTE: This is not secure and will need to be updated once we have the frontend hosted.
app.use(cors());

// Attach Firebase services to the request object
app.use((req, res, next) => {
    req.firestore = firestore;
    req.auth = auth;
    next();
  });

  app.use('/api', endpoints);



// Create HTTP & WebSocket servers
const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

// Register your room handlers
gameServer.define('card_room', CardRoom);
gameServer.define('blackjack', BlackjackRoom).enableRealtimeListing();
gameServer.define('horse_racing', HorseRacingRoom);
gameServer.define('roulette', RouletteRoom);
gameServer.define('poker', PokerRoom);
gameServer.define("baccarat", BaccaratRoom);
gameServer.define('lobby', Lobby);

// Use JSON body parsing
app.use(express.json());

// Express static file serving
app.use(express.static('public'));

// POST endpoint for creating rooms
app.post("/create-room", async (req, res) => {
    try {
        const room = await matchMaker.createRoom(req.body.roomType, req.body.options);
        res.json({ roomId: room.roomId });
    }
    catch (error)
    {
        res.status(400).json({ ERROR: error.message });
    }
});

// Custom Error Handler to return user-friendly error messages
app.use((err, req, res, next) => {
	console.error("ERROR:", err.message);
    if (err instanceof SyntaxError) {
        // Handle malformed JSON errors
        return res.status(400).json({ error: "Malformed JSON in request body." });
    }
    // Default error handling
    res.status(500).json({ error: "Internal server error." });
});

// Listen on specified port
gameServer.listen(port);
console.log(`Listening on ws://localhost:${port}`);
