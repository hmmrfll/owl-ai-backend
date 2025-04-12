// index.js
require('dotenv').config();
const express = require('express');
const { bot, startBot } = require('./bot/bot');
const databaseService = require('./services/databaseService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для обработки JSON
app.use(express.json());

// Роут для веб-хука Telegram
app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Инициализация сервера
async function start() {
    try {
        // Инициализация базы данных
        await databaseService.initializeDatabase();

        // Запуск сервера
        app.listen(PORT, () => {
            console.log(`Сервер запущен на порту ${PORT}`);

            // Настройка и запуск бота
            startBot();
        });
    } catch (error) {
        console.error('Ошибка при запуске сервера:', error);
        process.exit(1);
    }
}

start();