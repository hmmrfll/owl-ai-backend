// utils/keyboardUtils.js
/**
 * Создает конфигурацию для inline клавиатуры
 * @param {Array} buttons - Массив кнопок для inline клавиатуры
 * @returns {Object} - Конфигурация inline клавиатуры
 */
function createInlineKeyboard(buttons) {
    return {
        reply_markup: {
            inline_keyboard: buttons
        },
        parse_mode: 'Markdown'
    };
}

/**
 * Возвращает кнопку "Назад"
 * @returns {Array} - Массив с кнопкой "Назад"
 */
function getBackButton() {
    return [{ text: '◀️ Назад', callback_data: 'back_to_main' }];
}

/**
 * Возвращает кнопку "Назад к тарифам"
 * @returns {Array} - Массив с кнопкой "Назад к тарифам"
 */
function getBackToTariffsButton() {
    return [{ text: '◀️ Назад к тарифам', callback_data: 'subscription_menu' }];
}

/**
 * Возвращает кнопку "На главную"
 * @returns {Array} - Массив с кнопкой "На главную"
 */
function getMainMenuButton() {
    return [{ text: '🏠 На главную', callback_data: 'back_to_main' }];
}

/**
 * Создает набор кнопок для выбора способа оплаты
 * @param {string} tariffName - Название тарифа
 * @returns {Array} - Массив кнопок для выбора способа оплаты
 */
function getPaymentMethodsButtons(tariffName) {
    return [
        [{ text: '💰 Crypto Bot (USDT, TON, BTC)', callback_data: `pay_crypto_${tariffName}` }],
        [{ text: '⭐ Telegram Stars', callback_data: `pay_stars_${tariffName}` }],
        [{ text: '💳 Оплата картой', callback_data: `pay_card_${tariffName}` }],
        [{ text: '◀️ Назад к тарифу', callback_data: `tariff_${tariffName}` }],
        getBackToTariffsButton()
    ];
}

/**
 * Создает кнопки для тарифного меню
 * @returns {Array} - Массив кнопок для меню тарифов
 */
function getTariffMenuButtons() {
    return [
        [{ text: '🥈 Silver - идеальный старт', callback_data: 'tariff_silver' }],
        [{ text: '🥇 Gold - выбор тех, кто хочет больше', callback_data: 'tariff_gold' }],
        [{ text: '💎 Platinum - продвинутый уровень', callback_data: 'tariff_platinum' }],
        [{ text: '👑 Diamond - максимальные возможности', callback_data: 'tariff_diamond' }],
        getBackButton()
    ];
}

/**
 * Создает кнопки для выбора тарифа
 * @param {string} tariffName - Название тарифа
 * @returns {Array} - Массив кнопок для выбора тарифа
 */
function getTariffSelectionButtons(tariffName) {
    return [
        [{ text: '✅ Выбрать этот тариф', callback_data: `select_${tariffName}` }],
        getBackToTariffsButton()
    ];
}

/**
 * Создает кнопку для проверки оплаты
 * @param {string|number} invoiceId - ID инвойса
 * @returns {Array} - Массив с кнопкой проверки оплаты
 */
function getCheckPaymentButton(invoiceId) {
    return [{ text: '🔄 Проверить оплату', callback_data: `check_payment_${invoiceId}` }];
}

module.exports = {
    createInlineKeyboard,
    getBackButton,
    getBackToTariffsButton,
    getMainMenuButton,
    getPaymentMethodsButtons,
    getTariffMenuButtons,
    getTariffSelectionButtons,
    getCheckPaymentButton
};