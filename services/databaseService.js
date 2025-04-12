// services/databaseService.js
const db = require('../config/db');
const queries = require('../config/queries');

// Проверка существования таблиц
async function checkTablesExist() {
    const tablesStatus = {
        users: false,
        subscriptions: false,
        usage_stats: false,
        tariff_limits: false
    };

    try {
        // Получаем пул подключений
        const pool = db.getPool();

        // Проверяем существование каждой таблицы
        for (const tableName of Object.keys(tablesStatus)) {
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                )
            `, [tableName]);

            tablesStatus[tableName] = tableCheck.rows[0].exists;
        }

        return tablesStatus;
    } catch (error) {
        console.error('Ошибка при проверке таблиц:', error);
        throw error;
    }
}

// Инициализация тарифных планов
async function initTariffPlans() {
    try {
        const pool = db.getPool();

        // Проверяем, есть ли уже тарифные планы
        const checkResult = await pool.query(queries.tariffQueries.getTariffCount);

        if (parseInt(checkResult.rows[0].count) === 0) {
            // Вставляем тарифные планы
            const tariffs = [
                {
                    name: 'free',   // Базовый бесплатный тариф
                    photos: 1,      // Только 1 фото
                    documents: 1,   // Только 1 документ
                    ai_requests: -1, // Неограниченные текстовые запросы
                    priority_support: false,
                    features: { feature1: 'basic' }
                },
                {
                    name: 'silver',
                    photos: 50,
                    documents: 20,
                    ai_requests: 100,
                    priority_support: false,
                    features: { feature1: 'basic' }
                },
                {
                    name: 'gold',
                    photos: 150,
                    documents: 50,
                    ai_requests: 300,
                    priority_support: true,
                    features: { feature1: 'premium', feature2: 'enabled' }
                },
                {
                    name: 'platinum',
                    photos: 500,
                    documents: 100,
                    ai_requests: 1000,
                    priority_support: true,
                    features: { feature1: 'premium', feature2: 'enabled', feature3: 'enabled' }
                },
                {
                    name: 'diamond',
                    photos: -1, // -1 означает безлимитно
                    documents: -1,
                    ai_requests: -1,
                    priority_support: true,
                    features: { feature1: 'ultimate', feature2: 'enabled', feature3: 'enabled', feature4: 'enabled' }
                }
            ];

            // Вставляем каждый тариф
            for (const tariff of tariffs) {
                await pool.query(
                    queries.tariffQueries.insertTariffLimits,
                    [
                        tariff.name,
                        tariff.photos,
                        tariff.documents,
                        tariff.ai_requests,
                        tariff.priority_support,
                        JSON.stringify(tariff.features)
                    ]
                );
            }

            console.log('Тарифные планы успешно инициализированы');
        } else {
            console.log('Тарифные планы уже существуют');
        }
    } catch (error) {
        console.error('Ошибка при инициализации тарифных планов:', error);
        throw error;
    }
}

// Инициализация таблиц
async function initTables() {
    try {
        // Получаем пул подключений
        const pool = db.getPool();

        // Создаем таблицы из файла запросов
        await pool.query(queries.createTables.users);
        await pool.query(queries.createTables.subscriptions);
        await pool.query(queries.createTables.usage_stats);
        await pool.query(queries.createTables.tariff_limits);

        console.log('Таблицы успешно созданы');

        // Инициализируем тарифные планы
        await initTariffPlans();
    } catch (error) {
        console.error('Ошибка при создании таблиц:', error);
        throw error;
    }
}

// Добавьте эту функцию в databaseService.js
async function ensureFreeSubscriptionExists() {
    try {
        const pool = db.getPool();

        // Проверяем существование записи для free тарифа
        const freeCheck = await pool.query('SELECT * FROM tariff_limits WHERE tariff_name = $1', ['free']);

        if (freeCheck.rows.length === 0) {
            console.log('Тариф "free" отсутствует, добавляем...');
            await pool.query(
                queries.tariffQueries.insertTariffLimits,
                [
                    'free',  // name
                    1,       // photos
                    1,       // documents
                    -1,      // ai_requests (-1 = безлимитно)
                    false,   // priority_support
                    JSON.stringify({ feature1: 'basic' }) // features
                ]
            );
            console.log('Тариф "free" успешно добавлен');
        } else {
            console.log('Тариф "free" уже существует');
        }

        return true;
    } catch (error) {
        console.error('Ошибка при проверке тарифа "free":', error);
        throw error;
    }
}

// И вызовите эту функцию в initializeDatabase
async function initializeDatabase() {
    try {
        // Инициализируем подключение
        await db.initializeConnection();

        // Проверяем существование таблиц
        const tables = await checkTablesExist();

        // Создаем отсутствующие таблицы
        if (!tables.users || !tables.subscriptions || !tables.usage_stats || !tables.tariff_limits) {
            await initTables();
        } else {
            console.log('Все необходимые таблицы уже существуют');

            // Убедимся, что запись для free тарифа существует
            await ensureFreeSubscriptionExists();
        }

        return true;
    } catch (error) {
        console.error('Ошибка при инициализации БД:', error);
        throw error;
    }
}

module.exports = {
    initializeDatabase
};