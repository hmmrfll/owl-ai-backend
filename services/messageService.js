// services/messageService.js
/**
 * Сервис для работы с сообщениями
 */
class MessageService {
    /**
     * Создает новый экземпляр сервиса сообщений
     * @param {Object} bot - Экземпляр Telegram бота
     */
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Отправляет текстовое сообщение с клавиатурой
     * @param {number} chatId - ID чата
     * @param {string} text - Текст сообщения
     * @param {Array} keyboard - Массив кнопок для inline клавиатуры
     * @returns {Promise<Object>} - Отправленное сообщение
     */
    async sendTextWithKeyboard(chatId, text, keyboard) {
        return await this.bot.sendMessage(chatId, text, {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
        });
    }

    /**
     * Обновляет существующее сообщение
     * @param {number} chatId - ID чата
     * @param {number} messageId - ID сообщения
     * @param {string} text - Новый текст сообщения
     * @param {Array} keyboard - Новый массив кнопок для inline клавиатуры
     * @returns {Promise<Object>} - Обновленное сообщение
     */
    async updateMessage(chatId, messageId, text, keyboard) {
        try {
            return await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: keyboard },
                parse_mode: 'Markdown'
            });
        } catch (error) {
            // Если сообщение не изменилось, просто игнорируем ошибку
            if (error.description && error.description.includes('message is not modified')) {
                return;
            }
            throw error;
        }
    }

    /**
     * Отправляет уведомление через callback_query
     * @param {string} callbackQueryId - ID callback запроса
     * @param {string} text - Текст уведомления
     * @param {boolean} showAlert - Показывать как alert или нет
     * @returns {Promise<Object>} - Результат отправки уведомления
     */
    async sendNotification(callbackQueryId, text, showAlert = false) {
        return await this.bot.answerCallbackQuery(callbackQueryId, {
            text,
            show_alert: showAlert
        });
    }
}

module.exports = MessageService;