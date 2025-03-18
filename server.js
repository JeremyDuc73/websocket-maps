const express = require('express');
const http = require('node:http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: 'https://maps.jeremyduc.com',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: '*',
        credentials: true
    }
});

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: '*', credentials: true }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});


app.use(express.json());
app.use(express.static('public'));

let users = {};
let positions = [];
let activeRoutes = []; // 🔹 Stocke les itinéraires partagés

io.on('connection', (socket) => {
    console.log('🔗 Nouvel utilisateur connecté:', socket.id);
    users[socket.id] = { id: socket.id, position: null };

    console.log("Nombre d'utilisateurs:", Object.keys(users).length);

    // 🔹 Envoyer les données initiales y compris les itinéraires
    socket.emit('initialData', {
        userCount: Object.keys(users).length,
        positions,
        activeRoutes
    });

    // 🔹 Mise à jour de la position des utilisateurs
    socket.on('updateLocation', (position) => {
        console.log(`📍 Position de ${socket.id}:`, position);
        users[socket.id].position = position;
        positions = Object.values(users).map(user => user.position).filter(pos => pos !== null);

        io.emit('updateData', { userCount: Object.keys(users).length, positions });
    });

    // 🔹 Gestion du partage d'itinéraires
    socket.on('shareRoute', (steps) => {
        console.log(`🛣️ Nouvel itinéraire partagé par ${socket.id}`);
        activeRoutes = activeRoutes.filter(route => route.userId !== socket.id); // Supprime l'ancien itinéraire de cet utilisateur
        activeRoutes.push({ userId: socket.id, steps });

        io.emit('updateRoutes', activeRoutes); // Diffuser les itinéraires mis à jour
    });

    // 🔴 Déconnexion d'un utilisateur
    socket.on('disconnect', () => {
        console.log(`🔴 Déconnexion de ${socket.id}`);

        delete users[socket.id];
        positions = Object.values(users).map(user => user.position).filter(pos => pos !== null);

        // 🔹 Supprimer l'itinéraire de l'utilisateur déconnecté
        activeRoutes = activeRoutes.filter(route => route.userId !== socket.id);

        io.emit('updateData', { userCount: Object.keys(users).length, positions });
        io.emit('updateRoutes', activeRoutes);
    });
});

const PORT = 45009;
server.listen(PORT, () => {
    console.log(`🚀 Serveur WebSocket en écoute sur le port ${PORT}`);
});
