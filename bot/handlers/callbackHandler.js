// bot/handlers/callbackHandler.js
const MessageService = require('../../services/messageService');
const { createErrorHandler } = require('../../utils/errorHandler');
const { CALLBACK_TYPES } = require('../../constants/paymentConstants');
const createSubscriptionHandler = require('./subscriptionHandler/subscriptionHandler');

// Создаем фабрику для обработчика колбэков
function createCallbackHandler(bot) {
    const messageService = new MessageService(bot);
    const errorHandler = createErrorHandler(bot);
    const subscriptionHandler = createSubscriptionHandler(bot);

    // Функция для обработки callback-запросов (нажатий на кнопки)
    async function handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        const firstName = query.message.chat.first_name || '';
        const userId = query.from.id; // ID пользователя, который нажал на кнопку

        try {
            // Уведомляем Telegram, что запрос получен
            await bot.answerCallbackQuery(query.id);

            // Обработка различных типов callback-запросов
            if (data === CALLBACK_TYPES.SUBSCRIPTION_MENU) {
                await subscriptionHandler.handleSubscriptionMenu(chatId, messageId);
            }
            // Обработка выбора отдельных тарифов
            else if (data.startsWith(CALLBACK_TYPES.TARIFF)) {
                const tariffName = data.split('_')[1];
                await subscriptionHandler.handleTariffDetails(chatId, messageId, tariffName);
            }
            // Обработка выбора тарифа
            else if (data.startsWith(CALLBACK_TYPES.SELECT)) {
                const tariffName = data.split('_')[1];
                await subscriptionHandler.handleTariffSelection(chatId, messageId, tariffName, userId);
            }
            // Обработка платежных callback'ов
            else if (
                data.startsWith(CALLBACK_TYPES.PAY) ||
                data.startsWith(CALLBACK_TYPES.CHECK_PAYMENT) ||
                data.startsWith(CALLBACK_TYPES.CHECK_STARS_PAYMENT)
            ) {
                await subscriptionHandler.handlePaymentCallback(chatId, messageId, data, userId, query);
            }
            // Инициация платежа через Stars
            else if (data.startsWith(CALLBACK_TYPES.INITIATE_STARS_PAYMENT)) {
                const tariffName = data.split('_')[3];
                await subscriptionHandler.handleInitiatePayment(chatId, 'stars', tariffName, userId, query);
            }
            else if (data.startsWith(CALLBACK_TYPES.INITIATE_CARD_PAYMENT)) {
                const tariffName = data.split('_')[3];
                await subscriptionHandler.handleInitiatePayment(chatId, 'card', tariffName, userId, query);
            }
            // Возврат на главную
            else if (data === CALLBACK_TYPES.BACK_TO_MAIN) {
                await subscriptionHandler.handleBackToMain(chatId, messageId, firstName);
            }
        } catch (error) {
            await errorHandler.handleError(chatId, error, 'handleCallbackQuery');
        }
    }

    return handleCallbackQuery;
}

module.exports = createCallbackHandler;