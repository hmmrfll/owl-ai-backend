// services/cryptoPayService.js
const axios = require('axios');
require('dotenv').config();

// Получаем значения из переменных окружения
const API_TOKEN = process.env.CRYPTO_PAY_API_TOKEN;
const API_BASE_URL = process.env.CRYPTO_PAY_API_URL || 'https://pay.crypt.bot/api'; // Основная сеть по умолчанию

// Создаем HTTP клиент с заголовком авторизации
const cryptoPayClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Crypto-Pay-API-Token': API_TOKEN
    }
});

/**
 * Проверка соединения с API
 */
async function getMe() {
    try {
        const response = await cryptoPayClient.get('/getMe');
        return response.data.result;
    } catch (error) {
        console.error('Ошибка при проверке соединения с Crypto Pay API:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Создание инвойса для оплаты
 * @param {Object} params - Параметры инвойса
 * @returns {Promise<Object>} - Данные созданного инвойса
 */
async function createInvoice(params) {
    try {
        const response = await cryptoPayClient.post('/createInvoice', params);
        return response.data.result;
    } catch (error) {
        console.error('Ошибка при создании инвойса:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Получение списка инвойсов
 * @param {Object} params - Параметры запроса
 * @returns {Promise<Array>} - Список инвойсов
 */
async function getInvoices(params = {}) {
    try {
        // Преобразуем параметр invoice_ids в строку, если это число
        if (params.invoice_ids && typeof params.invoice_ids === 'number') {
            params.invoice_ids = params.invoice_ids.toString();
        }

        const response = await cryptoPayClient.get('/getInvoices', { params });

        // Проверка на наличие результата в ответе
        if (!response.data) {
            console.error('Пустой ответ от API');
            return [];
        }

        if (!response.data.ok) {
            console.error('Ошибка API:', response.data.error);
            return [];
        }

        // Проверяем, что результат содержит items
        if (!response.data.result || !response.data.result.items) {
            console.error('Ответ API не содержит items:', response.data);
            return [];
        }

        return response.data.result.items;
    } catch (error) {
        console.error('Ошибка при получении инвойсов:',
            error.response?.data || error.message,
            '\nСтек ошибки:', error.stack);
        return [];  // Возвращаем пустой массив вместо выброса исключения
    }
}

/**
 * Получение информации о конкретном инвойсе
 * @param {Number|String} invoiceId - ID инвойса
 * @returns {Promise<Object|null>} - Данные инвойса или null, если инвойс не найден
 */
async function getInvoiceById(invoiceId) {
    try {
        // Сначала пробуем получить инвойс напрямую по ID
        const invoiceIdStr = invoiceId.toString();
        let invoices = await getInvoices({ invoice_ids: invoiceIdStr });

        if (Array.isArray(invoices) && invoices.length > 0) {
            return invoices[0];
        }

        // Если не удалось найти по ID, получаем последние 10 инвойсов
        invoices = await getInvoices({ count: 10 });

        if (Array.isArray(invoices) && invoices.length > 0) {
            // Ищем нужный инвойс среди последних
            const foundInvoice = invoices.find(invoice => invoice.invoice_id.toString() === invoiceIdStr);
            if (foundInvoice) {
                return foundInvoice;
            }
        }

        // Попробуем искать среди всех инвойсов (и активных, и оплаченных)
        const activeInvoices = await getInvoices({ status: 'active', count: 100 }) || [];
        const paidInvoices = await getInvoices({ status: 'paid', count: 100 }) || [];

        // Проверяем, что мы получили массивы
        if (!Array.isArray(activeInvoices)) {
            console.error('activeInvoices не является массивом:', activeInvoices);
        }
        if (!Array.isArray(paidInvoices)) {
            console.error('paidInvoices не является массивом:', paidInvoices);
        }

        const allInvoices = [...activeInvoices, ...paidInvoices];
        const foundInvoice = allInvoices.find(invoice => invoice.invoice_id.toString() === invoiceIdStr);

        if (foundInvoice) {
            return foundInvoice;
        }

        return null;
    } catch (error) {
        console.error(`Ошибка при получении инвойса ${invoiceId}:`, error.message);
        return null;
    }
}

/**
 * Создание платежного инвойса для тарифа
 * @param {String} tariffName - Название тарифа
 * @param {Number} userId - ID пользователя Telegram
 * @returns {Promise<Object>} - Данные созданного инвойса
 */
async function createTariffInvoice(tariffName, userId) {
    const tariffData = {
        silver: { amount: '199', description: 'Тариф Silver – Правовой старт' },
        gold: { amount: '370', description: 'Тариф Gold – Правовая защита+' },
        platinum: { amount: '599', description: 'Тариф Platinum – Премиум консультант' },
        diamond: { amount: '999', description: 'Тариф Diamond – Личный юрист' }
    };

    if (!tariffData[tariffName]) {
        throw new Error(`Неизвестный тариф: ${tariffName}`);
    }

    const { amount, description } = tariffData[tariffName];
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot_username';

    const invoiceParams = {
        currency_type: 'fiat', // Используем фиатную валюту вместо криптовалюты
        fiat: 'RUB',  // Указываем рубли как валюту
        accepted_assets: 'TON,USDT,BTC', // Криптовалюты, которые могут быть использованы для оплаты
        amount,
        description,
        hidden_message: `Спасибо за оплату тарифа ${tariffName.charAt(0).toUpperCase() + tariffName.slice(1)}!`,
        paid_btn_name: 'callback',
        paid_btn_url: `https://t.me/${botUsername}`, // Используем переменную окружения
        payload: JSON.stringify({
            tariff: tariffName,
            user_id: userId,
            timestamp: Date.now()
        }),
        allow_comments: false,
        allow_anonymous: false,
        expires_in: 3600 // Инвойс истекает через 1 час
    };

    return await createInvoice(invoiceParams);
}

module.exports = {
    getMe,
    createInvoice,
    getInvoices,
    getInvoiceById,
    createTariffInvoice
};