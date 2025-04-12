// utils/errorHandler.js
/**
 * Обрабатывает ошибки и отправляет сообщение пользователю
 * @param {Object} bot - Экземпляр Telegram бота
 * @param {number} chatId - ID чата
 * @param {Error} error - Объект ошибки
 * @param {string} context - Контекст, в котором произошла ошибка
 * @returns {Promise<void>}
 */
async function handleError(bot, chatId, error, context) {
    console.error(`Ошибка в ${context}:`, error);

    // Игнорируем ошибку о том, что сообщение не изменилось
    if (error.description && error.description.includes('message is not modified')) {
        return;
    }

    let userMessage = 'Произошла ошибка. Пожалуйста, попробуйте позже.';

    try {
        await bot.sendMessage(chatId, userMessage);
    } catch (sendError) {
        console.error('Ошибка при отправке сообщения об ошибке:', sendError);
    }
}

/**
 * Возвращает объект-помощник для обработки ошибок
 * @param {Object} bot - Экземпляр Telegram бота
 * @returns {Object} - Объект для обработки ошибок
 */
function createErrorHandler(bot) {
    return {
        /**
         * Обрабатывает ошибки и отправляет сообщение пользователю
         * @param {number} chatId - ID чата
         * @param {Error} error - Объект ошибки
         * @param {string} context - Контекст, в котором произошла ошибка
         * @returns {Promise<void>}
         */
        async handleError(chatId, error, context) {
            await handleError(bot, chatId, error, context);
        }
    };
}

module.exports = {
    handleError,
    createErrorHandler
};