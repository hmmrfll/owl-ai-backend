// config/db.js
const { Pool } = require('pg');

// Пул соединений будет инициализирован позже
let pool = null;

// Функция для инициализации подключения к БД
async function initializeConnection() {
    try {
        // Сначала подключаемся к postgres для проверки/создания нашей БД
        const tempPool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: 'postgres',
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 5432,
        });

        const dbName = process.env.DB_NAME;
        const client = await tempPool.connect();

        // Проверяем существование БД
        const dbExists = await client.query(`
            SELECT EXISTS (SELECT FROM pg_database WHERE datname = $1)
        `, [dbName]);

        // Создаем БД если не существует
        if (!dbExists.rows[0].exists) {
            console.log(`База данных ${dbName} не существует. Создаю...`);
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`База данных ${dbName} успешно создана.`);
        } else {
            console.log(`База данных ${dbName} уже существует.`);
        }

        client.release();
        await tempPool.end(); // Закрываем временный пул

        // Теперь создаем основной пул для работы с нашей БД
        pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: dbName,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 5432,
        });

        // Тестируем соединение
        const appClient = await pool.connect();
        console.log('Успешное подключение к основной базе данных');
        appClient.release();

        return pool;
    } catch (error) {
        console.error('Ошибка при инициализации подключения:', error);
        throw error;
    }
}

module.exports = {
    initializeConnection,
    getPool: () => {
        if (!pool) {
            throw new Error('Пул подключений не инициализирован. Сначала вызовите initializeConnection()');
        }
        return pool;
    }
};