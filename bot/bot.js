// bot/bot.js
const TelegramBot = require('node-telegram-bot-api');
const createStartHandler = require('./handlers/startHandler');
const createCallbackHandler = require('./handlers/callbackHandler');
const createSubscriptionHandler = require('./handlers/subscriptionHandler/subscriptionHandler');
const userService = require('../services/userService');
const aiService = require('../services/aiService');

const token = process.env.BOT_TOKEN;
const url = process.env.WEBHOOK_URL;

// Создаем экземпляр бота
const bot = new TelegramBot(token);

// Функция для запуска бота
async function startBot() {
    try {
        // Устанавливаем веб-хук
        await bot.setWebHook(`${url}/webhook/${token}`);
        console.log('Веб-хук успешно установлен');

        const handleStart = createStartHandler(bot);
        const handleCallbackQuery = createCallbackHandler(bot);

        // Регистрируем обработчики команд
        bot.onText(/\/start/, handleStart);

        bot.on('callback_query', handleCallbackQuery);

        // Деактивируем истекшие подписки при запуске
        userService.deactivateExpiredSubscriptions()
            .then(deactivated => {
                if (deactivated.length > 0) {
                    console.log(`Деактивировано ${deactivated.length} истекших подписок`);
                }
            })
            .catch(err => console.error('Ошибка при деактивации подписок:', err));

        // Обработка pre-checkout запросов
        bot.on('pre_checkout_query', async (query) => {
            try {
                // Подтверждаем pre-checkout запрос
                await bot.answerPreCheckoutQuery(query.id, true);
            } catch (error) {
                console.error('Ошибка при обработке pre_checkout_query:', error);
            }
        });

        // Обработка успешных платежей
        bot.on('successful_payment', async (msg) => {
            try {
                const payment = msg.successful_payment;
                const chatId = msg.chat.id;

                try {
                    const payload = JSON.parse(payment.invoice_payload);
                    const { tariff, userId, paymentMethod } = payload;

                    if (tariff && userId) {
                        const tariffDisplayName = tariff.charAt(0).toUpperCase() + tariff.slice(1);
                        const subscriptionHandler = createSubscriptionHandler(bot);

                        // Выбираем соответствующий обработчик платежей в зависимости от метода
                        let paymentHandler;
                        if (payment.currency === 'XTR') {
                            paymentHandler = subscriptionHandler.paymentHandlers.stars;
                        } else if (paymentMethod === 'card') {
                            paymentHandler = subscriptionHandler.paymentHandlers.card;
                        }

                        if (paymentHandler) {
                            // Сохраняем информацию о подтвержденном платеже
                            paymentHandler.createdInvoices.set(
                                `${userId}_${tariff}_paid`,
                                {
                                    confirmed: new Date().getTime(),
                                    payment_id: payment.telegram_payment_charge_id,
                                    invoice_id: msg.successful_payment.invoice_payload // сохраняем ID инвойса
                                }
                            );
                        }

                        // Активируем подписку в базе данных
                        await userService.activateSubscription(userId, tariff, {
                            payment_id: payment.telegram_payment_charge_id,
                            payment_method: payment.currency === 'XTR' ? 'stars' : paymentMethod,
                            payment_amount: payment.total_amount / 100 // Конвертируем из копеек/центов
                        });

                        // Отправляем сообщение пользователю
                        await bot.sendMessage(chatId, `
*Оплата успешно получена!* ✅

Ваш тариф *${tariffDisplayName}* активирован.
Спасибо за доверие к нашему сервису!
                `, {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🏠 На главную', callback_data: 'back_to_main' }]
                                ]
                            }
                        });

                        // Отправляем информацию о новых лимитах
                        const userInfo = await userService.getUserResourcesInfo(userId);
                        let resourcesMessage = `
*Ваши ресурсы по тарифу ${userInfo.tariffDisplayName}*

📷 Фотографии: ${userInfo.photos.used}/${userInfo.photos.limit}
📄 Документы: ${userInfo.documents.used}/${userInfo.documents.limit}
🤖 AI запросы: ${userInfo.aiRequests.used}/${userInfo.aiRequests.limit}

Срок действия: до ${new Date(userInfo.endDate).toLocaleDateString()}
`;

                        await bot.sendMessage(chatId, resourcesMessage, {
                            parse_mode: 'Markdown'
                        });
                    }
                } catch (e) {
                    console.error('Ошибка при обработке payload:', e);
                }
            } catch (error) {
                console.error('Ошибка при обработке successful_payment:', error);
            }
        });

        // Обработка входящих фотографий
        // Обработка входящих фотографий
        bot.on('photo', async (msg) => {
            const userId = msg.from.id;
            const chatId = msg.chat.id;

            try {
                // Проверяем, не превышен ли лимит фотографий
                const photoLimits = await userService.checkUserLimits(userId, 'photo');

                if (!photoLimits.canUse) {
                    return bot.sendMessage(
                        chatId,
                        `*Достигнут лимит обработки фотографий* ⚠️\n\nВы использовали ${photoLimits.current} из ${photoLimits.limit} доступных фотографий в этом месяце.\n\nДля увеличения лимита оформите подписку, используя команду /subscribe.`,
                        { parse_mode: 'Markdown' }
                    );
                }

                // Показываем, что бот обрабатывает фото
                await bot.sendChatAction(chatId, 'typing');

                // Получаем фото (берем самое большое разрешение)
                const photoId = msg.photo[msg.photo.length - 1].file_id;
                const fileLink = await bot.getFileLink(photoId);

                // Отправляем сообщение о начале обработки
                await bot.sendMessage(chatId, 'Анализирую изображение... Это может занять некоторое время.');

                // Можно добавить описание из сообщения, если оно есть
                const caption = msg.caption || '';

                // Формируем промпт для AI
                const prompt = `Перед вами фотография юридического документа или ситуации. 
Вы - юридический помощник. Внимательно проанализируйте изображение и предоставьте юридическую оценку. 
Если на изображении текст документа, расскажите о его правовом значении.
Если это фотография ситуации, дайте правовую оценку с точки зрения российского законодательства.
${caption ? 'Пользователь также добавил описание: ' + caption : ''}
Ссылка на изображение: ${fileLink}`;

                // Отправляем запрос к OpenAI через наш сервис
                const aiResponse = await aiService.processRequest(prompt);

                // Логируем использование ресурса
                await userService.logResourceUsage(userId, 'photo');

                // Отправляем результат анализа
                await bot.sendMessage(chatId, aiResponse, { parse_mode: 'Markdown' });

                // Если это была единственная доступная фотография для бесплатного пользователя,
                // уведомляем об этом
                const updatedLimits = await userService.checkUserLimits(userId, 'photo');
                if (!updatedLimits.canUse) {
                    await bot.sendMessage(
                        chatId,
                        `*Внимание!* Вы использовали все доступные обработки фотографий на бесплатном тарифе.\n\nДля обработки большего количества фотографий оформите подписку, используя команду /subscribe.`,
                        { parse_mode: 'Markdown' }
                    );
                }

            } catch (error) {
                console.error('Ошибка при обработке фотографии:', error);
                bot.sendMessage(chatId, 'Произошла ошибка при обработке фотографии. Пожалуйста, попробуйте позже.');
            }
        });

        // Обработка входящих документов
        // Обработка входящих документов
        bot.on('document', async (msg) => {
            const userId = msg.from.id;
            const chatId = msg.chat.id;

            try {
                // Проверяем, не превышен ли лимит документов
                const docLimits = await userService.checkUserLimits(userId, 'document');

                if (!docLimits.canUse) {
                    return bot.sendMessage(
                        chatId,
                        `*Достигнут лимит обработки документов* ⚠️\n\nВы использовали ${docLimits.current} из ${docLimits.limit} доступных документов в этом месяце.\n\nДля увеличения лимита оформите подписку, используя команду /subscribe.`,
                        { parse_mode: 'Markdown' }
                    );
                }

                // Показываем, что бот обрабатывает документ
                await bot.sendChatAction(chatId, 'typing');

                // Получаем документ
                const docId = msg.document.file_id;
                const docName = msg.document.file_name || 'документ';
                const fileLink = await bot.getFileLink(docId);

                // Проверяем расширение файла
                const fileExtension = docName.split('.').pop().toLowerCase();
                const supportedExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf'];

                if (!supportedExtensions.includes(fileExtension)) {
                    return bot.sendMessage(
                        chatId,
                        `*Неподдерживаемый формат файла* ⚠️\n\nПоддерживаемые форматы: ${supportedExtensions.join(', ')}`,
                        { parse_mode: 'Markdown' }
                    );
                }

                // Отправляем сообщение о начале обработки
                await bot.sendMessage(chatId, `Анализирую документ "${docName}"... Это может занять некоторое время.`);

                // Можно добавить описание из сообщения, если оно есть
                const caption = msg.caption || '';

                // Формируем промпт для AI
                const prompt = `Перед вами юридический документ "${docName}". 
Вы - юридический помощник. Внимательно проанализируйте документ и предоставьте юридическую оценку. 
Объясните правовое значение документа, выделите важные моменты и дайте рекомендации с точки зрения российского законодательства.
${caption ? 'Пользователь также добавил описание: ' + caption : ''}
Ссылка на документ: ${fileLink}`;

                // Отправляем запрос к OpenAI через наш сервис
                const aiResponse = await aiService.processRequest(prompt);

                // Логируем использование ресурса
                await userService.logResourceUsage(userId, 'document');

                // Отправляем результат анализа
                await bot.sendMessage(chatId, aiResponse, { parse_mode: 'Markdown' });

                // Если это был единственный доступный документ для бесплатного пользователя,
                // уведомляем об этом
                const updatedLimits = await userService.checkUserLimits(userId, 'document');
                if (!updatedLimits.canUse) {
                    await bot.sendMessage(
                        chatId,
                        `*Внимание!* Вы использовали все доступные обработки документов на бесплатном тарифе.\n\nДля обработки большего количества документов оформите подписку, используя команду /subscribe.`,
                        { parse_mode: 'Markdown' }
                    );
                }

            } catch (error) {
                console.error('Ошибка при обработке документа:', error);
                bot.sendMessage(chatId, 'Произошла ошибка при обработке документа. Пожалуйста, попробуйте позже.');
            }
        });

        // Команда для просмотра текущего статуса подписки
        bot.onText(/\/status/, async (msg) => {
            const userId = msg.from.id;
            const chatId = msg.chat.id;

            try {
                const userInfo = await userService.getUserResourcesInfo(userId);

                let statusMessage = `*Информация о вашей подписке*\n\n`;

                if (userInfo.isActive) {
                    statusMessage += `🔹 Тариф: *${userInfo.tariffDisplayName}*\n`;
                    statusMessage += `🔹 Активен до: *${new Date(userInfo.endDate).toLocaleDateString()}*\n\n`;
                } else {
                    statusMessage += `🔹 Тариф: *${userInfo.tariffDisplayName}*\n`;
                    statusMessage += `🔹 У вас нет активной платной подписки\n\n`;
                }

                statusMessage += `*Доступные ресурсы:*\n`;
                statusMessage += `📷 Фотографии: ${userInfo.photos.used}/${userInfo.photos.limit} (осталось: ${userInfo.photos.remaining})\n`;
                statusMessage += `📄 Документы: ${userInfo.documents.used}/${userInfo.documents.limit} (осталось: ${userInfo.documents.remaining})\n`;
                statusMessage += `🤖 AI запросы: ${userInfo.aiRequests.used}/${userInfo.aiRequests.limit === 'безлимитно' ? 'безлимитно' : userInfo.aiRequests.limit} (осталось: ${userInfo.aiRequests.remaining})\n\n`;

                if (userInfo.prioritySupport) {
                    statusMessage += `✅ У вас есть приоритетная поддержка\n`;
                }

                if (!userInfo.isActive) {
                    statusMessage += `\nХотите получить больше возможностей? Используйте команду /subscribe для обновления тарифа.`;
                }

                await bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });

            } catch (error) {
                console.error('Ошибка при получении статуса подписки:', error);
                bot.sendMessage(chatId, 'Произошла ошибка при получении информации о вашей подписке. Пожалуйста, попробуйте позже.');
            }
        });
        // Добавьте в файл bot.js после других обработчиков

// Обработка текстовых сообщений для AI запросов
        // Обработка текстовых сообщений для AI запросов
        bot.on('text', async (msg) => {
            // Игнорируем команды
            if (msg.text.startsWith('/')) return;

            const userId = msg.from.id;
            const chatId = msg.chat.id;

            try {
                // Проверяем, не превышен ли лимит AI запросов
                const aiLimits = await userService.checkUserLimits(userId, 'ai_request');

                if (!aiLimits.canUse) {
                    return bot.sendMessage(
                        chatId,
                        `*Достигнут лимит AI запросов* ⚠️\n\nВы использовали ${aiLimits.current} из ${aiLimits.limit} доступных AI запросов в этом месяце.\n\nДля увеличения лимита оформите подписку, используя команду /subscribe.`,
                        { parse_mode: 'Markdown' }
                    );
                }

                // Показываем, что бот печатает
                await bot.sendChatAction(chatId, 'typing');

                // Формируем промпт для AI, добавляя юридический контекст
                const userInput = msg.text;
                const prompt = `Вы - юридический помощник для пользователей из России. Отвечайте на вопросы кратко и по существу, основываясь на российском законодательстве. Если нужно уточнение или вопрос недостаточно ясен, попросите предоставить дополнительную информацию. Вопрос: ${userInput}`;

                // Отправляем запрос к OpenAI через наш сервис
                const aiResponse = await aiService.processRequest(prompt);

                // Логируем использование ресурса
                await userService.logResourceUsage(userId, 'ai_request');

                // Отправляем ответ с использованием Markdown форматирования
                await bot.sendMessage(chatId, aiResponse, { parse_mode: 'Markdown' });

            } catch (error) {
                console.error('Ошибка при обработке AI запроса:', error);
                bot.sendMessage(chatId, 'Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
            }
        });

        // Добавьте в файл bot.js обработчик команды /subscribe

// Команда для просмотра доступных тарифов и оформления подписки
        // В файле bot.js, обработчик команды /subscribe
        bot.onText(/\/subscribe/, async (msg) => {
            const chatId = msg.chat.id;

            try {
                // Создаем описание тарифов прямо здесь, без запроса к subscriptionHandler
                const subscriptionMessage = `
*Выберите подходящий тарифный план* 💳

🥈 *Silver* - идеальный старт
- 50 фотографий в месяц
- 20 документов в месяц
- 100 AI запросов в месяц
- Стоимость: 199 ₽/месяц

🥇 *Gold* - выбор тех, кто хочет больше
- 150 фотографий в месяц
- 50 документов в месяц
- 300 AI запросов в месяц
- Приоритетная поддержка
- Стоимость: 370 ₽/месяц

💎 *Platinum* - продвинутый уровень
- 500 фотографий в месяц
- 100 документов в месяц
- 1000 AI запросов в месяц
- Приоритетная поддержка
- Дополнительные функции
- Стоимость: 599 ₽/месяц

👑 *Diamond* - максимальные возможности
- Безлимитные фотографии
- Безлимитные документы
- Безлимитные AI запросы
- Приоритетная поддержка
- Все дополнительные функции
- Стоимость: 999 ₽/месяц
`;

                // Отправляем сообщение с кнопками тарифов
                await bot.sendMessage(chatId, subscriptionMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🥈 Silver - идеальный старт', callback_data: 'tariff_silver' }],
                            [{ text: '🥇 Gold - выбор тех, кто хочет больше', callback_data: 'tariff_gold' }],
                            [{ text: '💎 Platinum - продвинутый уровень', callback_data: 'tariff_platinum' }],
                            [{ text: '👑 Diamond - максимальные возможности', callback_data: 'tariff_diamond' }]
                        ]
                    }
                });
            } catch (error) {
                console.error('Ошибка при показе тарифов:', error);
                bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
            }
        });

        // В функции startBot в файле bot.js добавьте периодическую проверку истекших подписок

// Задаем интервал для проверки и деактивации истекших подписок (раз в день)
        setInterval(() => {
            userService.deactivateExpiredSubscriptions()
                .then(deactivated => {
                    if (deactivated.length > 0) {
                        console.log(`Деактивировано ${deactivated.length} истекших подписок`);

                        // Можно отправить уведомления пользователям об истекших подписках
                        deactivated.forEach(async subscription => {
                            try {
                                const chatId = subscription.user_id; // предполагается, что user_id и chat_id совпадают
                                await bot.sendMessage(chatId,
                                    `*Уведомление о подписке* ⚠️\n\nСрок действия вашей подписки на тариф *${subscription.tariff_name.charAt(0).toUpperCase() + subscription.tariff_name.slice(1)}* истек.\n\nДля возобновления доступа к полному функционалу бота, пожалуйста, обновите вашу подписку с помощью команды /subscribe.`,
                                    { parse_mode: 'Markdown' }
                                );
                            } catch (error) {
                                console.error('Ошибка при отправке уведомления об истекшей подписке:', error);
                            }
                        });
                    }
                })
                .catch(err => console.error('Ошибка при деактивации истекших подписок:', err));
        }, 24 * 60 * 60 * 1000); // 24 часа

        console.log('Бот успешно запущен');
    } catch (error) {
        console.error('Ошибка при запуске бота:', error);
        throw error;
    }
}

module.exports = { bot, startBot };