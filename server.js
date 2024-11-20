const express = require('express');
const path = require('path');
const fs = require('fs');
const ws = require('ws');
const http = require('http');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

var connected_sockets = {};

// Enable CORS
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for getting the list of connected clients
app.get('/api/clients', (req, res) => {
    const clients = Object.keys(connected_sockets);
    res.json(clients);
});

// Route for the sounds list
app.get('/api/sounds', (req, res) => {
    const sounds = fs.readdirSync(path.join(__dirname, 'sounds'));
    var data = {};
    for (var i = 0; i < sounds.length; i++) {
        const extension = sounds[i].split('.')[1];
        sounds[i] = sounds[i].split('.')[0];
        data[sounds[i]] = extension;
    }
    res.json(data);
});

// Route for play sound request
app.get('/api/play/sound/:sound/:extension/:username', (req, res) => {
    console.log('sending sound');
    const sound = req.params.sound.replace(/%20/g, ' ');
    const extension = req.params.extension;
    console.log(sound + '.' + extension);
    const soundFile = path.join(__dirname, 'sounds', `${sound}.${extension}`);
    if (fs.existsSync(soundFile)) {
        for (var key in connected_sockets) {
            const soundData = fs.readFileSync(soundFile);
            const data = { sound: soundData, username: req.params.username };
            connected_sockets[key].send(JSON.stringify(data));
        }
        res.status(200).send('Sound played');
    } else {
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

// Create a WebSocket server
const wss = new ws.Server({ noServer: true });

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