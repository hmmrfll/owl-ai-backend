// bot/handlers/subscriptionHandler/paymentHandlers/starsPaymentHandler.js
const BasePaymentHandler = require('./basePaymentHandler');

class StarsPaymentHandler extends BasePaymentHandler {
    constructor(bot) {
        super(bot);
        this.bot = bot;
    }

    async showPaymentMethods(chatId, messageId, tariffName) {
        const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);
        const starsAmount = this.getStarsAmountForTariff(tariffName);

        const paymentMethodsMessage = `
*Выберите подходящий способ оплаты*

Тариф: *${tariffDisplayName}*
Стоимость: *${starsAmount} Stars*

Доступные способы оплаты:
`;

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `⭐ Оплатить ${starsAmount} Stars`, callback_data: `pay_stars_${tariffName}` }],
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
            const starsAmount = this.getStarsAmountForTariff(tariffName);
            const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);

            // Вместо создания инвойса, подготовим сообщение с кнопкой для оплаты
            const paymentMessage = `
*Оплата тарифа ${tariffDisplayName} через Telegram Stars*

Стоимость: *${starsAmount} Stars*

Для оплаты нажмите на кнопку ниже. После завершения оплаты нажмите "Проверить оплату".
`;

            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        // Здесь можно использовать специальный URL для оплаты через Stars или только кнопку "Проверить оплату"
                        [{ text: `⭐ Оплатить ${starsAmount} Stars`, callback_data: `initiate_stars_payment_${tariffName}` }],
                        [{ text: '🔄 Проверить оплату', callback_data: `check_stars_payment_${tariffName}_${userId}` }],
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

            // Запомним информацию о платеже
            this.createdInvoices.set(`${userId}_${tariffName}`, {
                tariffName,
                userId,
                starsAmount,
                created: new Date().getTime()
            });

        } catch (error) {
            console.error('Ошибка при подготовке платежа Stars:', error);
            throw error;
        }
    }

    async initiatePayment(chatId, tariffName, userId, query) {
        try {
            const starsAmount = this.getStarsAmountForTariff(tariffName);
            const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);

            // Создаем инвойс для Stars
            const invoice = await this.bot.sendInvoice(
                chatId,
                `Подписка ${tariffDisplayName}`,
                `Активация подписки ${tariffDisplayName} на 1 месяц`,
                JSON.stringify({ tariff: tariffName, userId }),
                '',
                'XTR',
                [{ label: 'Подписка', amount: starsAmount }],
                {
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
            await this.bot.answerCallbackQuery(query.id, {
                text: "Инвойс для оплаты создан. Пожалуйста, оплатите и затем нажмите 'Проверить оплату'.",
                show_alert: true
            });

            return true;
        } catch (error) {
            console.error('Ошибка при создании инвойса Stars:', error);
            throw error;
        }
    }

    async handleCheckPayment(chatId, messageId, data, query) {
        try {
            console.log('Данные callback:', data);

            const parts = data.split('_');
            const tariffName = parts[3];
            const userId = parts[4];

            console.log('Извлеченный тариф:', tariffName, 'userId:', userId);

            const tariffDisplayName = tariffName.charAt(0).toUpperCase() + tariffName.slice(1);
            const starsAmount = this.getStarsAmountForTariff(tariffName);

            // Проверяем, был ли создан инвойс
            const invoiceKey = `${userId}_${tariffName}_invoice`;
            const hasInvoice = this.createdInvoices.has(invoiceKey);

            console.log('Ключ инвойса:', invoiceKey, 'Найден:', hasInvoice);
            console.log('Все ключи:', Array.from(this.createdInvoices.keys()));

            // В реальном приложении здесь должна быть проверка через API Telegram
            const paymentConfirmedKey = `${userId}_${tariffName}_paid`;
            const isPaymentConfirmed = this.createdInvoices.has(paymentConfirmedKey);

            // Ключ для отслеживания последнего статуса сообщения
            const messageStatusKey = `${userId}_${tariffName}_message_status`;
            const currentStatus = this.createdInvoices.get(messageStatusKey)?.status || '';

            try {
                if (hasInvoice && isPaymentConfirmed) {
                    // Платеж подтвержден
                    if (currentStatus !== 'success') {
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

                        // Обновляем статус сообщения
                        this.createdInvoices.set(messageStatusKey, { status: 'success' });

                        // Очищаем данные о платеже
                        this.createdInvoices.delete(invoiceKey);
                        this.createdInvoices.delete(paymentConfirmedKey);
                    } else {
                        // Если статус тот же, просто отправим уведомление
                        await this.bot.answerCallbackQuery(query.id, {
                            text: "Ваша подписка уже активирована.",
                            show_alert: false
                        });
                    }
                } else if (hasInvoice) {
                    // Платеж не подтвержден
                    if (currentStatus !== 'waiting') {
                        const waitingMessage = `
*Ожидание подтверждения оплаты* ⏳

Мы пока не получили подтверждение оплаты тарифа *${tariffDisplayName}* на сумму *${starsAmount} Stars*.

Если вы уже оплатили счет, пожалуйста, подождите некоторое время и нажмите "Проверить оплату" еще раз.
`;

                        const keyboard = {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🔄 Проверить оплату', callback_data: `check_stars_payment_${tariffName}_${userId}` }],
                                    [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }]
                                ]
                            },
                            parse_mode: 'Markdown'
                        };

                        await this.bot.editMessageText(waitingMessage, {
                            chat_id: chatId,
                            message_id: messageId,
                            ...keyboard
                        });

                        // Обновляем статус сообщения
                        this.createdInvoices.set(messageStatusKey, { status: 'waiting' });
                    } else {
                        // Если статус тот же, просто отправим уведомление
                        await this.bot.answerCallbackQuery(query.id, {
                            text: "Платеж все еще не подтвержден. Пожалуйста, подождите...",
                            show_alert: false
                        });
                    }
                } else {
                    // Инвойс не найден
                    if (currentStatus !== 'notfound') {
                        const noInvoiceMessage = `
*Оплата не найдена* ❌

Мы не обнаружили созданный счет для оплаты тарифа *${tariffDisplayName}*.

Пожалуйста, сначала нажмите кнопку "Оплатить ${starsAmount} Stars" и завершите процесс оплаты.
`;

                        const keyboard = {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: `⭐ Оплатить ${starsAmount} Stars`, callback_data: `initiate_stars_payment_${tariffName}` }],
                                    [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }]
                                ]
                            },
                            parse_mode: 'Markdown'
                        };

                        await this.bot.editMessageText(noInvoiceMessage, {
                            chat_id: chatId,
                            message_id: messageId,
                            ...keyboard
                        });

                        // Обновляем статус сообщения
                        this.createdInvoices.set(messageStatusKey, { status: 'notfound' });
                    } else {
                        // Если статус тот же, просто отправим уведомление
                        await this.bot.answerCallbackQuery(query.id, {
                            text: "Счет не найден. Пожалуйста, создайте новый.",
                            show_alert: false
                        });
                    }
                }
            } catch (editError) {
                // Обрабатываем ошибки при редактировании сообщения
                if (editError.description && editError.description.includes('message is not modified')) {
                    // Сообщение не изменилось, просто отправляем уведомление
                    await this.bot.answerCallbackQuery(query.id, {
                        text: "Обновление статуса платежа...",
                        show_alert: false
                    });
                } else {
                    // Другие ошибки - перебрасываем дальше
                    throw editError;
                }
            }
        } catch (error) {
            console.error('Ошибка при проверке оплаты Stars:', error);
            throw error;
        }
    }
    getStarsAmountForTariff(tariffName) {
        // Стоимость исходя из курса: 1 Star ≈ 2,04 рубля
        const tariffPrices = {
            silver: 99,    // 199 руб
            gold: 180,     // 370 руб
            platinum: 299, // 599 руб
            diamond: 490   // 999 руб
        };
        // Используем silver как значение по умолчанию
        return tariffPrices[tariffName] || tariffPrices.silver;
    }
}

module.exports = StarsPaymentHandler;