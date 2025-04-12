// bot/handlers/startHandler.js
const userService = require('../../services/userService');
const messages = require('../../templates/messages');

// Создаем фабрику для обработчика команды /start
function createStartHandler(bot) {
    // Обработчик команды /start
    async function handleStart(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const firstName = msg.from.first_name || '';
        const lastName = msg.from.last_name || '';
        const username = msg.from.username || '';
        const languageCode = msg.from.language_code || 'ru';

        try {
            // Сохраняем информацию о пользователе в БД
            await userService.saveUser({
                user_id: userId,
                chat_id: chatId,
                first_name: firstName,
                last_name: lastName,
                username: username,
                language_code: languageCode,
                joined_at: new Date()
            });

            // Формируем приветственное сообщение
            const welcomeMessage = messages.getWelcomeMessage(firstName);

            // Создаем клавиатуру с кнопкой подписки
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💳 Хочу взять подписку', callback_data: 'subscription_menu' }]
                    ]
                },
                parse_mode: 'Markdown'
            };

            // Отправляем приветственное сообщение с клавиатурой
            bot.sendMessage(chatId, welcomeMessage, keyboard);
        } catch (error) {
            console.error('Ошибка при обработке команды /start:', error);
            bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
        }
    }

    return handleStart;
}

module.exports = createStartHandler;