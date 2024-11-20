const express = require('express');
const path = require('path');
const fs = require('fs');
const ws = require('ws');
const http = require('http');
const multer = require('multer');

const app = express();
const port = 3000;

var connected_sockets = {}; // Corrected typo

// Create a WebSocket server
const wss = new ws.Server({ noServer: true });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for getting the list of connected clients
app.get('/api/clients', (req, res) => {
    // Get the list of connected clients
    const clients = Object.keys(connected_sockets);
    // Send the list of clients as JSON
    res.json(clients);
});

// Route for the sounds list
app.get('/api/sounds', (req, res) => {
    // Get the sounds from the sounds folder
    const sounds = fs.readdirSync(path.join(__dirname, 'sounds'));
    // Create a data object with the sounds
    var data = {};
    for (var i = 0; i < sounds.length; i++) {
        // separate the file extension from the sound name
        const extension = sounds[i].split('.')[1];
        sounds[i] = sounds[i].split('.')[0];
        // Add the sound to the data object
        data[sounds[i]] = extension;
    }
    // Send the data object as JSON
    res.json(data);
});

// Route for play sound request
app.get('/api/play/sound/:sound/:extension/:username', (req, res) => {
    console.log('sending sound');
    // Get the sound name from the URL parameter
    const sound = req.params.sound.replace(/%20/g, ' ');
    const extension = req.params.extension;
    console.log(sound + '.' + extension);
    // Get the sound file path
    const soundFile = path.join(__dirname, 'sounds', `${sound}.${extension}`);
    // Check if the sound file exists
    if (fs.existsSync(soundFile)) {
        // Play the sound via the WebSocket server
        for (var key in connected_sockets) {
            // Send the sound file to all connected clients
            const soundData = fs.readFileSync(soundFile);
            const data = { sound: soundData, username: req.params.username };
            connected_sockets[key].send(JSON.stringify(data));
        }
        res.status(200).send('Sound played');
    } else {
        // Send a 404 response if the sound file does not exist
        res.status(404).send('Sound not found');
    }
});

// Route for uploading a sound file
// Set up multer for file uploads
const upload = multer({ dest: 'sounds/' });

app.post('/api/upload/sound', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Rename the file to its original name
    const oldPath = req.file.path;
    const newPath = path.join(__dirname, 'sounds', req.file.originalname);

    fs.rename(oldPath, newPath, (err) => {
        if (err) {
            return res.status(500).send('Error saving file.');
        }
        res.status(200).send('File uploaded successfully.');
    });
});

const server = http.createServer(app);

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.username != undefined) {
            connected_sockets[parsedMessage.username] = ws;
        }
        console.log(`Received message => ${message}`);
    });

    ws.on('close', () => {
        for (let username in connected_sockets) {
            if (connected_sockets[username] === ws) {
                delete connected_sockets[username];
                break;
            }
        }
        console.log('Client disconnected');
    });
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});