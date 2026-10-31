const express = require('express');
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const app = express();

app.use(express.json());
app.use(express.static('public'));

let bots = {}; 
let logs = [];
let isRunning = false;
let lastLogMessage = ""; 

function addLog(text) {
    if (text === lastLogMessage) return;
    lastLogMessage = text;

    const time = new Date().toLocaleTimeString();
    const logText = `[${time}] ${text}`;
    logs.push(logText);
    if (logs.length > 100) logs.shift();
    console.log(logText);
}

function createBot(nick, password, host) {
    addLog(`[SYSTEM] Tworzenie bota: ${nick} na ${host}...`);
    
    try {
        const bot = mineflayer.createBot({
            host: host,
            port: 25565,
            username: nick,
            version: '1.21.4',
            viewDistance: 'tiny',
            physicsEnabled: true,
            chatLengthLimit: 100,
            acceptResourcePack: true
        });

        bot.loadPlugin(pathfinder);

        let hasMoved = false;
        let isRegistered = false;

        const startMoving = () => {
            if (hasMoved) return;
            hasMoved = true;
            
            addLog(`[BOT] ${nick} zaczyna ruch (pathfinder).`);
            const defaultMove = new Movements(bot);
            bot.pathfinder.setMovements(defaultMove);
            
            const pos = bot.entity.position;
            const target = new goals.GoalNear(pos.x + 5, pos.y, pos.z + 5, 1);
            bot.pathfinder.setGoal(target);
        };

        bot.on('spawn', () => {
            addLog(`[BOT] ${nick} pojawił się w świecie.`);
        });

        bot.on('resourcePack', () => {
            addLog(`[BOT] ${nick} akceptuje paczkę zasobów.`);
            bot.acceptResourcePack();
        });

        bot.on('windowOpen', (window) => {
            if (!isRegistered) {
                const greenSlot = window.slots.findIndex(s => s && s.name === 'green_concrete');
                if (greenSlot !== -1) {
                    isRegistered = true;
                    addLog(`[BOT] ${nick} klika zielony beton (regulamin).`);
                    setTimeout(() => {
                        bot.simpleClick.leftMouse(greenSlot);
                    }, 800);
                }
            }
        });

        bot.on('windowClose', () => {
            if (isRegistered && !hasMoved) {
                startMoving();
            }
        });

        bot.on('message', (jsonMsg) => {
            const msg = jsonMsg.toString();
            if (msg.trim() === '') return; 
            
            if (msg.includes("pomyślnie zalogowany") || msg.includes("zarejestrowano")) {
                addLog(`[BOT] ${nick} pomyślnie zalogowany/rejestracja.`);
                return;
            }

            if (msg.includes("/register") && msg.includes("<kod>")) {
                const match = msg.match(/\b\d{4,6}\b/);
                const kod = match ? match[0] : "";
                if (kod) {
                    addLog(`[BOT] ${nick} rejestruje się z kodem: ${kod}`);
                    setTimeout(() => bot.chat(`/register ${password} ${password} ${kod}`), 1000);
                }
                return;
            }

            if (msg.includes("Zaloguj się komendą /login")) {
                addLog(`[BOT] ${nick} wymaga logowania.`);
                setTimeout(() => bot.chat(`/login ${password}`), 1000);
                return;
            }

            if (msg.includes("regulamin") || msg.includes("akceptuj")) {
                addLog(`[BOT] ${nick} akceptuje regulamin (czat).`);
                bot.chat("/akceptuj");
                return;
            }

            if (msg.includes("Weryfikacja pozycji") || msg.includes("Zacznij się poruszać")) {
                startMoving();
                return;
            }

            addLog(`[SERWER] ${msg}`);
        });

        const originalChat = bot.chat;
        bot.chat = function(message) {
            addLog(`[CZAT] ${nick} -> ${message}`);
            originalChat.call(bot, message);
        };

        bot.on('end', () => {
            addLog(`[BOT] ${nick} rozłączony.`);
            delete bots[nick];
        });

        bot.on('error', (err) => {
            addLog(`[ERROR] ${nick}: ${err.message}`);
        });
        
        bot.on('kicked', (reason) => {
            let kickReason = "Nieznany";
            try {
                if (typeof reason === 'string') kickReason = reason;
                else if (typeof reason === 'object') kickReason = JSON.stringify(reason);
            } catch (e) {
                kickReason = String(reason);
            }
            addLog(`[KICK] ${nick}: ${kickReason}`);
        });

        bots[nick] = bot;
    } catch (err) {
        addLog(`[ERROR] Nie udało się stworzyć bota ${nick}: ${err.message}`);
    }
}

app.post('/api/start', (req, res) => {
    if (isRunning) return res.status(400).json({ error: "Boty już działają!" });
    
    const { botsList, password, cooldown, host } = req.body;
    if (!botsList || botsList.length === 0) return res.status(400).json({ error: "Brak botów do uruchomienia." });

    isRunning = true;
    lastLogMessage = ""; 
    addLog(`[SYSTEM] Uruchamianie botów na ${host}...`);

    let i = 0;
    const interval = setInterval(() => {
        if (!isRunning || i >= botsList.length) {
            clearInterval(interval);
            return;
        }
        createBot(botsList[i], password, host);
        i++;
    }, parseInt(cooldown) * 1000);

    res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
    isRunning = false;
    for (const nick in bots) {
        bots[nick].quit();
    }
    bots = {};
    addLog("[SYSTEM] Wszystkie boty zatrzymane.");
    res.json({ success: true });
});

app.get('/api/logs', (req, res) => {
    res.json(logs);
});

app.listen(3000, () => console.log('Serwer działa na porcie 3000'));
