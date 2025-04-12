// bot/handlers/subscriptionHandler/paymentHandlers/cardPaymentHandler.js
const BasePaymentHandler = require('./basePaymentHandler');
const { formatTariffName, formatPrice } = require('../../../../utils/formatUtils');
const { getBackToTariffsButton, getMainMenuButton } = require('../../../../utils/keyboardUtils');
const {
    createPaymentMethodsMessage,
    createCardPaymentMessage,
    createPaymentSuccessMessage
} = require('../../../../templates/messageTemplates');
const tariffs = require('../../../../config/tariffs');
const { PAYMENT_METHODS } = require('../../../../constants/paymentConstants');

class CardPaymentHandler extends BasePaymentHandler {
    /**
     * Создает обработчик платежей картой
     * @param {Object} bot - Экземпляр Telegram бота
     */
    constructor(bot) {
        super(bot);
        this.providerToken = process.env.PAYMENT_PROVIDER_TOKEN; // Токен провайдера платежей
    }

    /**
     * Показывает методы оплаты
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {string} tariffName - Название тарифа
     */
    async showPaymentMethods(chatId, messageId, tariffName) {
        try {
            const tariffDisplayName = formatTariffName(tariffName);
            const price = this.getPriceForTariff(tariffName);
            const formattedPrice = formatPrice(price, 'RUB');

            const message = createPaymentMethodsMessage(tariffDisplayName, formattedPrice);

            const keyboard = [
                [{ text: '💰 Crypto Bot (USDT, TON, BTC)', callback_data: `pay_crypto_${tariffName}` }],
                [{ text: '⭐ Telegram Stars', callback_data: `pay_stars_${tariffName}` }],
                [{ text: '💳 Оплата картой', callback_data: `pay_card_${tariffName}` }],
                [{ text: '◀️ Назад к тарифу', callback_data: `tariff_${tariffName}` }],
                getBackToTariffsButton()
            ];

            await this.messageService.updateMessage(chatId, messageId, message, keyboard);
        } catch (error) {
            await this.errorHandler.handleError(chatId, error, 'CardPaymentHandler.showPaymentMethods');
        }
    }

    /**
     * Обрабатывает запрос на оплату картой
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {string} tariffName - Название тарифа
     * @param {number} userId - ID пользователя
     */
    async handlePayment(chatId, messageId, tariffName, userId) {
        try {
            const price = this.getPriceForTariff(tariffName);
            const tariffDisplayName = formatTariffName(tariffName);
            const formattedPrice = formatPrice(price, 'RUB');

            const message = createCardPaymentMessage(tariffDisplayName, formattedPrice);

            const keyboard = [
                [{ text: `💳 Оплатить ${formattedPrice}`, callback_data: `initiate_card_payment_${tariffName}` }],
                [{ text: '◀️ Другой способ оплаты', callback_data: `select_${tariffName}` }],
                getBackToTariffsButton()
            ];

            await this.messageService.updateMessage(chatId, messageId, message, keyboard);

            // Запомним информацию о потенциальном платеже
            this.createdInvoices.set(`${userId}_${tariffName}`, {
                tariffName,
                userId,
                price,
                created: new Date().getTime()
            });
        } catch (error) {
            console.error('Ошибка при подготовке платежа картой:', error);
            await this.errorHandler.handleError(chatId, error, 'CardPaymentHandler.handlePayment');
        }
    }

    /**
     * Инициирует процесс оплаты картой
     * @param {number} chatId - ID чата
     * @param {string} tariffName - Название тарифа
     * @param {number} userId - ID пользователя
     * @param {Object} query - Объект callback запроса
     */
    async initiatePayment(chatId, tariffName, userId, query) {
        try {
            if (!this.providerToken) {
                throw new Error('Токен провайдера платежей не настроен.');
            }

            const price = this.getPriceForTariff(tariffName);
            const tariffDisplayName = formatTariffName(tariffName);

            // Создаем платежный инвойс
            const invoice = await this.bot.sendInvoice(
                chatId,
                `Подписка ${tariffDisplayName}`, // title
                `Активация подписки ${tariffDisplayName} на 1 месяц`, // description
                JSON.stringify({ tariff: tariffName, userId, paymentMethod: PAYMENT_METHODS.CARD }), // payload
                this.providerToken, // провайдер платежей
                'RUB', // валюта
                [{ label: 'Подписка', amount: price * 100 }], // цены в копейках
                {
                    photo_url: `https://example.com/tariff_images/${tariffName}.jpg`, // опционально: фото товара
                    need_name: false,
                    need_phone_number: false,
                    need_email: false,
                    need_shipping_address: false,
                    is_flexible: false
                }
            );

            // Сохраняем информацию о платеже
            this.createdInvoices.set(`${userId}_${tariffName}_invoice`, {
                messageId: invoice.message_id,
                invoice_id: invoice.message_id,
                created: new Date().getTime()
            });

            // Информируем пользователя
            await this.messageService.sendNotification(
                query.id,
                "Инвойс для оплаты создан. Пожалуйста, следуйте инструкциям для оплаты.",
                true
            );

            return true;
        } catch (error) {
            console.error('Ошибка при создании инвойса для оплаты картой:', error);

            // Если ошибка связана с отсутствием токена провайдера, сообщаем об этом пользователю
            if (error.message.includes('Токен провайдера платежей не настроен')) {
                await this.messageService.sendNotification(
                    query.id,
                    "Оплата картой временно недоступна. Пожалуйста, выберите другой способ оплаты.",
                    true
                );
            } else {
                await this.messageService.sendNotification(
                    query.id,
                    "Ошибка при создании платежа. Пожалуйста, попробуйте позже или выберите другой способ оплаты.",
                    true
                );
            }

            throw error;
        }
    }

    /**
     * Обрабатывает запрос на проверку оплаты картой
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {string} data - Данные callback запроса
     * @param {Object} query - Объект callback запроса
     */
    async handleCheckPayment(chatId, messageId, data, query) {
        try {
            const parts = data.split('_');
            const invoiceId = parts[2]; // Предполагаем, что формат: check_card_payment_invoiceId

            // Проверка наличия записи о платеже в системе
            const hasPayment = Array.from(this.createdInvoices.entries())
                .some(([key, value]) => key.includes('_paid') && value.invoice_id === invoiceId);

            if (hasPayment) {
                // Если платеж найден, показываем сообщение об успешной оплате
                const successMessage = createPaymentSuccessMessage(
                    formatTariffName(this.createdInvoices.get(`${query.from.id}_paid`).tariffName || 'выбранный')
                );

                const keyboard = [getMainMenuButton()];

                await this.messageService.updateMessage(chatId, messageId, successMessage, keyboard);
            } else {
                // Если платеж не найден
                await this.messageService.sendNotification(
                    query.id,
                    "Информация о платеже не найдена или платеж еще не завершен. Если вы уже оплатили, подождите некоторое время.",
                    true
                );
            }
        } catch (error) {
            console.error('Ошибка при проверке оплаты картой:', error);
            await this.errorHandler.handleError(chatId, error, 'CardPaymentHandler.handleCheckPayment');
        }
    }

    /**
     * Получает цену тарифа
     * @param {string} tariffName - Название тарифа
     * @returns {number} - Цена тарифа
     */
    getPriceForTariff(tariffName) {
        return tariffs[tariffName]?.prices?.rub || tariffs.silver.prices.rub;
    }
}

module.exports = CardPaymentHandler;