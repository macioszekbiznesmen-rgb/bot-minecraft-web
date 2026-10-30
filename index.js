const express = require('express');
const mineflayer = require('mineflayer');
const app = express();

app.use(express.json());
app.use(express.static('public')); // Serwuje pliki z folderu public

let bot = null;
let logs = [];

app.post('/api/start', (req, res) => {
    const { nick, password } = req.body;
    if (bot) return res.status(400).json({ error: "Bot już działa!" });

    logs = ["[SYSTEM] Uruchamianie bota..."];
    
    try {
        bot = mineflayer.createBot({
            host: 'minestar.pl',
            port: 25565,
            username: nick,
            version: '1.21.4'
        });

        bot.on('login', () => {
            logs.push(`[BOT] ${nick} wszedł na serwer.`);
            setTimeout(() => {
                bot.chat(`/register ${password} ${password}`);
                setTimeout(() => bot.chat(`/login ${password}`), 1000);
            }, 2000);
        });

        bot.on('message', (jsonMsg) => {
            logs.push(`[CZAT] ${jsonMsg.toString()}`);
            if (logs.length > 50) logs.shift();
        });

        bot.on('end', () => {
            logs.push(`[BOT] ${nick} rozłączony.`);
            bot = null;
        });

        bot.on('error', (err) => {
            logs.push(`[BŁĄD] ${err.message}`);
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/stop', (req, res) => {
    if (bot) {
        bot.quit();
        bot = null;
        logs.push("[SYSTEM] Bot zatrzymany.");
    }
    res.json({ success: true });
});

app.get('/api/logs', (req, res) => {
    res.json(logs);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));