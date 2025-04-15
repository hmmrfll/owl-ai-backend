// bot/handlers/subscriptionHandler/paymentHandlers/cryptoPaymentHandler.js
const BasePaymentHandler = require('./basePaymentHandler');
const cryptoPayService = require('../../../../services/cryptoPayService');
const userService = require('../../../../services/userService');


class CryptoPaymentHandler extends BasePaymentHandler {
    constructor(bot) {
        super(bot);
        this.bot = bot;
    }

    async showPaymentMethods(chatId, messageId, tariffName) {
        // Убедимся, что tariffName определен и является строкой
        if (!tariffName || typeof tariffName !== 'string') {
            console.error('Ошибка: tariffName не определен или не является строкой', tariffName);
            throw new Error('Неверный параметр tariffName');
        }

        const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);

        const paymentMethodsMessage = `
*Выберите подходящий способ оплаты*

Тариф: *${tariffDisplayName}*

Доступные способы оплаты:
`;

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 Crypto Bot (USDT, TON, BTC)', callback_data: `pay_crypto_${tariffName}` }],
                    [{ text: '⭐ Telegram Stars', callback_data: `pay_stars_${tariffName}` }],
                    [{ text: '◀️ Назад к тарифу', callback_data: `tariff_${tariffName}` }],
                    [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }]
                ]
            },
            parse_mode: 'Markdown'
        };

        await this.bot.editMessageText(paymentMethodsMessage, {
            chat_id: chatId,
            message_id: messageId,
            ...keyboard
        });
    }

    async handlePayment(chatId, messageId, tariffName, userId) {
        try {
            const invoice = await cryptoPayService.createTariffInvoice(tariffName, userId);
            this.createdInvoices.set(invoice.invoice_id.toString(), invoice);

            const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);
            const paymentMessage = `
*Оплата тарифа ${tariffDisplayName} через Crypto Bot*

Для оплаты перейдите по ссылке ниже:
${invoice.bot_invoice_url}

Счет действителен в течение 1 часа.
ID счета: ${invoice.invoice_id}
`;

            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💲 Оплатить', url: invoice.bot_invoice_url }],
                        [{ text: '🔄 Проверить оплату', callback_data: `check_payment_${invoice.invoice_id}` }],
                        [{ text: '◀️ Другой способ оплаты', callback_data: `select_${tariffName}` }],
                        [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }]
                    ]
                },
                parse_mode: 'Markdown'
            };

            await this.bot.editMessageText(paymentMessage, {
                chat_id: chatId,
                message_id: messageId,
                ...keyboard
            });
        } catch (error) {
            console.error('Ошибка при создании платежа:', error);
            throw error;
        }
    }

    async handleCheckPayment(chatId, messageId, invoiceId, query) {
        try {
            // Получаем информацию об инвойсе через API
            let invoice = await cryptoPayService.getInvoiceById(invoiceId);

            // Если не нашли через API, но есть в локальном хранилище
            if (!invoice && this.createdInvoices.has(invoiceId.toString())) {
                invoice = this.createdInvoices.get(invoiceId.toString());

                // Попытаемся получить актуальный статус через другой метод API
                try {
                    const latestInvoices = await cryptoPayService.getInvoices({ count: 100 });
                    const updatedInvoice = latestInvoices.find(inv => inv.invoice_id.toString() === invoiceId.toString());
                    if (updatedInvoice) {
                        invoice = updatedInvoice;
                    }
                } catch (e) {
                    console.error('Ошибка при получении актуального статуса:', e);
                }
            }

            if (!invoice) {
                // Инвойс не найден, сообщаем пользователю
                const notFoundMessage = `
*Информация о платеже не найдена* ⚠️

Не удалось получить информацию о платеже (ID: ${invoiceId}). 
Возможно, счет был создан слишком давно или произошла ошибка.

Пожалуйста, попробуйте создать новый счет.
`;

                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }],
                            [{ text: '🏠 На главную', callback_data: 'back_to_main' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                };

                await this.bot.editMessageText(notFoundMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...keyboard
                });

                return;
            }

            // Обработка различных статусов инвойса
            if (invoice.status === 'paid') {
                // Инвойс оплачен, активируем подписку
                let payload = {};
                try {
                    if (invoice.payload) {
                        payload = JSON.parse(invoice.payload);
                    }
                } catch (e) {
                    console.error('Ошибка при разборе payload:', e);
                }

                const tariffName = payload.tariff || 'выбранный';
                const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);

                // Активируем подписку в базе данных
                const userId = payload.user_id || query.from.id;
                await userService.activateSubscription(userId, tariffName, {
                    payment_id: invoice.invoice_id.toString(),
                    payment_method: 'crypto',
                    payment_amount: parseFloat(invoice.amount)
                });

                const successMessage = `
*Оплата успешно получена!* ✅

Ваш тариф *${tariffDisplayName}* активирован.
Спасибо за доверие к нашему сервису!
`;

                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🏠 На главную', callback_data: 'back_to_main' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                };

                await this.bot.editMessageText(successMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...keyboard
                });
            } else if (invoice.status === 'active') {
                // Инвойс еще не оплачен
                let tariffName = 'выбранный';
                try {
                    if (invoice.payload) {
                        const payload = JSON.parse(invoice.payload);
                        tariffName = payload.tariff || tariffName;
                    }
                } catch (e) {
                    console.error('Ошибка при разборе payload:', e);
                }

                const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);

                const waitingMessage = `
*Ожидание оплаты* ⏳

Счет за тариф *${tariffDisplayName}* еще не оплачен.

Пожалуйста, перейдите по ссылке для оплаты или повторите проверку позже.
`;

                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💲 Оплатить', url: invoice.bot_invoice_url }],
                            [{ text: '🔄 Проверить оплату', callback_data: `check_payment_${invoice.invoice_id}` }],
                            [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }],
                            [{ text: '🏠 На главную', callback_data: 'back_to_main' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                };

                try {
                    await this.bot.editMessageText(waitingMessage, {
                        chat_id: chatId,
                        message_id: messageId,
                        ...keyboard
                    });
                } catch (msgError) {
                    console.error('Ошибка при обновлении сообщения:', msgError.description || msgError.message);
                    // Если сообщение не изменилось, информируем пользователя через callback
                    if (query && msgError.description && msgError.description.includes('message is not modified')) {
                        await this.bot.answerCallbackQuery(query.id, {
                            text: 'Счет все еще ожидает оплаты. Пожалуйста, оплатите или проверьте позже.',
                            show_alert: true
                        });
                    }
                }
            } else if (invoice.status === 'expired') {
                // Инвойс истек
                const expiredMessage = `
*Срок действия счета истек* ⌛

Счет уже не может быть оплачен, так как время его действия закончилось.

Пожалуйста, создайте новый счет для оплаты.
`;

                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }],
                            [{ text: '🏠 На главную', callback_data: 'back_to_main' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                };

                await this.bot.editMessageText(expiredMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...keyboard
                });
            } else {
                // Другие статусы (например, отмененные счета)
                const statusMessage = `
*Статус счета: ${invoice.status}* ℹ️

Счет не может быть оплачен.

Пожалуйста, создайте новый счет для оплаты.
`;

                const keyboard = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }],
                            [{ text: '🏠 На главную', callback_data: 'back_to_main' }]
                        ]
                    },
                    parse_mode: 'Markdown'
                };

                await this.bot.editMessageText(statusMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...keyboard
                });
            }
        } catch (error) {
            console.error('Ошибка при проверке оплаты:', error);

            const errorMessage = `
*Ошибка при проверке оплаты*

К сожалению, возникла ошибка при проверке оплаты. Пожалуйста, попробуйте позже.

Техническая информация: ${error.message || 'Неизвестная ошибка'}
`;

            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Попробовать снова', callback_data: `check_payment_${invoiceId}` }],
                        [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }],
                        [{ text: '🏠 На главную', callback_data: 'back_to_main' }]
                    ]
                },
                parse_mode: 'Markdown'
            };

            try {
                await this.bot.editMessageText(errorMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...keyboard
                });
            } catch (msgError) {
                console.error('Ошибка при обновлении сообщения об ошибке:', msgError.description || msgError.message);
                // Если не удается обновить сообщение, отправляем новое
                if (msgError.description && msgError.description.includes('message is not modified')) {
                    await this.bot.sendMessage(chatId, 'Повторите попытку позже или выберите другой способ оплаты.');
                }
            }
        }
    }
}

module.exports = CryptoPaymentHandler;