// bot/handlers/subscriptionHandler/subscriptionHandler.js
const messages = require('../../../templates/messages');
const MessageService = require('../../../services/messageService');
const { createErrorHandler } = require('../../../utils/errorHandler');
const { getTariffMenuButtons, getTariffSelectionButtons } = require('../../../utils/keyboardUtils');
const { PAYMENT_METHODS } = require('../../../constants/paymentConstants');
const CryptoPaymentHandler = require('./paymentHandlers/cryptoPaymentHandler');
const StarsPaymentHandler = require('./paymentHandlers/starsPaymentHandler');
const CardPaymentHandler = require('./paymentHandlers/cardPaymentHandler');

// Создаем фабрику для инициализации обработчиков платежей
function createPaymentHandlers(bot) {
    return {
        [PAYMENT_METHODS.CRYPTO]: new CryptoPaymentHandler(bot),
        [PAYMENT_METHODS.STARS]: new StarsPaymentHandler(bot),
        [PAYMENT_METHODS.CARD]: new CardPaymentHandler(bot)
    };
}

// Теперь нужно экспортировать функцию, которая создаст объект с методами
function createSubscriptionHandler(bot) {
    // Инициализация обработчиков
    const messageService = new MessageService(bot);
    const errorHandler = createErrorHandler(bot);
    const paymentHandlers = createPaymentHandlers(bot);

    // Функция для обработки меню подписок
    async function handleSubscriptionMenu(chatId, messageId) {
        try {
            const subscriptionMessage = messages.getSubscriptionMessage();
            const keyboard = getTariffMenuButtons();

            await messageService.updateMessage(chatId, messageId, subscriptionMessage, keyboard);
        } catch (error) {
            await errorHandler.handleError(chatId, error, 'handleSubscriptionMenu');
        }
    }

    // Функция для отображения деталей тарифа
    async function handleTariffDetails(chatId, messageId, tariffName) {
        try {
            const tariffMessage = messages.tariffs[tariffName];
            const keyboard = getTariffSelectionButtons(tariffName);

            await messageService.updateMessage(chatId, messageId, tariffMessage, keyboard);
        } catch (error) {
            await errorHandler.handleError(chatId, error, 'handleTariffDetails');
        }
    }

    // Функция для обработки выбора тарифа
    async function handleTariffSelection(chatId, messageId, tariffName, userId) {
        try {
            // Используем обработчик для отображения методов оплаты
            await paymentHandlers[PAYMENT_METHODS.CRYPTO].showPaymentMethods(chatId, messageId, tariffName);
        } catch (error) {
            await errorHandler.handleError(chatId, error, 'handleTariffSelection');
        }
    }

    // Функция для обработки платежных callback'ов
    async function handlePaymentCallback(chatId, messageId, callbackData, userId, query) {
        try {
            const [action, paymentMethod, ...rest] = callbackData.split('_');

            if (action === 'pay' && paymentHandlers[paymentMethod]) {
                const tariffName = rest.join('_');
                await paymentHandlers[paymentMethod].handlePayment(chatId, messageId, tariffName, userId);
            } else if (action === 'check') {
                // Обработка проверки платежа для Stars и других методов
                if (paymentMethod === 'stars' && paymentHandlers[PAYMENT_METHODS.STARS]) {
                    await paymentHandlers[PAYMENT_METHODS.STARS].handleCheckPayment(chatId, messageId, callbackData, query);
                } else if (paymentMethod === 'payment') {
                    const invoiceId = rest.join('_');
                    for (const handler of Object.values(paymentHandlers)) {
                        try {
                            await handler.handleCheckPayment(chatId, messageId, invoiceId, query);
                            return;
                        } catch (e) {
                            continue;
                        }
                    }
                    throw new Error('Не удалось проверить платеж');
                }
            }
        } catch (error) {
            await errorHandler.handleError(chatId, error, 'handlePaymentCallback');
        }
    }

    // Функция для инициации платежа
    async function handleInitiatePayment(chatId, paymentType, tariffName, userId, query) {
        try {
            if (paymentType === PAYMENT_METHODS.STARS && paymentHandlers[PAYMENT_METHODS.STARS]) {
                await paymentHandlers[PAYMENT_METHODS.STARS].initiatePayment(chatId, tariffName, userId, query);
            } else if (paymentType === PAYMENT_METHODS.CARD && paymentHandlers[PAYMENT_METHODS.CARD]) {
                await paymentHandlers[PAYMENT_METHODS.CARD].initiatePayment(chatId, tariffName, userId, query);
            } else {
                throw new Error(`Неподдерживаемый тип платежа: ${paymentType}`);
            }
        } catch (error) {
            await errorHandler.handleError(chatId, error, 'handleInitiatePayment');
        }
    }

    // Функция для возврата на главную
    async function handleBackToMain(chatId, messageId, firstName) {
        try {
            const welcomeMessage = messages.getWelcomeMessage(firstName);
            const keyboard = [
                [{ text: '💳 Хочу взять подписку', callback_data: 'subscription_menu' }]
            ];

            await messageService.updateMessage(chatId, messageId, welcomeMessage, keyboard);
        } catch (error) {
            await errorHandler.handleError(chatId, error, 'handleBackToMain');
        }
    }

    // Возвращаем объект с методами и обработчиками платежей
    return {
        handleSubscriptionMenu,
        handleTariffDetails,
        handleTariffSelection,
        handlePaymentCallback,
        handleInitiatePayment,
        handleBackToMain,
        paymentHandlers
    };
}

module.exports = createSubscriptionHandler;