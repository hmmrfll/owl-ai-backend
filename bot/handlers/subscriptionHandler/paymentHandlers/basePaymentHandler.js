// bot/handlers/subscriptionHandler/paymentHandlers/basePaymentHandler.js
const MessageService = require('../../../../services/messageService');
const { createErrorHandler } = require('../../../../utils/errorHandler');

class BasePaymentHandler {
    /**
     * Создает базовый обработчик платежей
     * @param {Object} bot - Экземпляр Telegram бота
     */
    constructor(bot) {
        this.bot = bot;
        this.createdInvoices = new Map(); // Общее хранилище инвойсов
        this.messageService = new MessageService(bot);
        this.errorHandler = createErrorHandler(bot);
    }

    /**
     * Обрабатывает запрос на оплату
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {string} tariffName - Название тарифа
     * @param {number} userId - ID пользователя
     */
    async handlePayment(chatId, messageId, tariffName, userId) {
        throw new Error('Method not implemented');
    }

    /**
     * Обрабатывает запрос на проверку оплаты
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {string} data - Данные callback запроса
     * @param {Object} query - Объект callback запроса
     */
    async handleCheckPayment(chatId, messageId, data, query) {
        throw new Error('Method not implemented');
    }

    /**
     * Показывает методы оплаты
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {string} tariffName - Название тарифа
     */
    async showPaymentMethods(chatId, messageId, tariffName) {
        throw new Error('Method not implemented');
    }

    /**
     * Инициирует процесс оплаты
     * @param {number} chatId - ID чата
     * @param {string} tariffName - Название тарифа
     * @param {number} userId - ID пользователя
     * @param {Object} query - Объект callback запроса
     */
    async initiatePayment(chatId, tariffName, userId, query) {
        throw new Error('Method not implemented');
    }
}

module.exports = BasePaymentHandler;