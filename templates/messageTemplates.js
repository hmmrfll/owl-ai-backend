// templates/messageTemplates.js
/**
 * Создает сообщение для выбора способа оплаты
 * @param {string} tariffName - Название тарифа
 * @param {string} price - Отформатированная цена
 * @returns {string} - Сообщение для выбора способа оплаты
 */
function createPaymentMethodsMessage(tariffName, price) {
    return `
*Выберите подходящий способ оплаты*

Тариф: *${tariffName}*
Стоимость: *${price}*

Доступные способы оплаты:
`;
}

/**
 * Создает сообщение для оплаты картой
 * @param {string} tariffName - Название тарифа
 * @param {string} price - Отформатированная цена
 * @returns {string} - Сообщение для оплаты картой
 */
function createCardPaymentMessage(tariffName, price) {
    return `
*Оплата тарифа ${tariffName} банковской картой*

Стоимость: *${price}*

Для оплаты нажмите на кнопку ниже. Платеж будет обработан через безопасную систему Telegram.
`;
}

/**
 * Создает сообщение для оплаты через Stars
 * @param {string} tariffName - Название тарифа
 * @param {string} price - Отформатированная цена
 * @returns {string} - Сообщение для оплаты через Stars
 */
function createStarsPaymentMessage(tariffName, price) {
    return `
*Оплата тарифа ${tariffName} через Telegram Stars*

Стоимость: *${price}*

Для оплаты нажмите на кнопку ниже. После завершения оплаты нажмите "Проверить оплату".
`;
}

/**
 * Создает сообщение для оплаты через Crypto
 * @param {string} tariffName - Название тарифа
 * @param {string} price - Отформатированная цена
 * @param {string} invoiceUrl - URL для оплаты
 * @param {string|number} invoiceId - ID инвойса
 * @returns {string} - Сообщение для оплаты через Crypto
 */
function createCryptoPaymentMessage(tariffName, price, invoiceUrl, invoiceId) {
    return `
*Оплата тарифа ${tariffName} через Crypto Bot*

Для оплаты перейдите по ссылке ниже:
${invoiceUrl}

Счет действителен в течение 1 часа.
ID счета: ${invoiceId}
`;
}

/**
 * Создает сообщение об успешной оплате
 * @param {string} tariffName - Название тарифа
 * @returns {string} - Сообщение об успешной оплате
 */
function createPaymentSuccessMessage(tariffName) {
    return `
*Оплата успешно получена!* ✅

Ваш тариф *${tariffName}* активирован.
Спасибо за доверие к нашему сервису!
`;
}

/**
 * Создает сообщение об ожидании оплаты
 * @param {string} tariffName - Название тарифа
 * @returns {string} - Сообщение об ожидании оплаты
 */
function createPaymentWaitingMessage(tariffName) {
    return `
*Ожидание оплаты* ⏳

Счет за тариф *${tariffName}* еще не оплачен.

Пожалуйста, перейдите по ссылке для оплаты или повторите проверку позже.
`;
}

/**
 * Создает сообщение об истекшем платеже
 * @returns {string} - Сообщение об истекшем платеже
 */
function createPaymentExpiredMessage() {
    return `
*Срок действия счета истек* ⌛

Счет уже не может быть оплачен, так как время его действия закончилось.

Пожалуйста, создайте новый счет для оплаты.
`;
}

/**
 * Создает сообщение о неизвестном статусе платежа
 * @param {string} status - Статус платежа
 * @returns {string} - Сообщение о неизвестном статусе платежа
 */
function createPaymentUnknownStatusMessage(status) {
    return `
*Статус счета: ${status}* ℹ️

Счет не может быть оплачен.

Пожалуйста, создайте новый счет для оплаты.
`;
}

/**
 * Создает сообщение о не найденном платеже
 * @param {string|number} invoiceId - ID инвойса
 * @returns {string} - Сообщение о не найденном платеже
 */
function createPaymentNotFoundMessage(invoiceId) {
    return `
*Информация о платеже не найдена* ⚠️

Не удалось получить информацию о платеже (ID: ${invoiceId}). 
Возможно, счет был создан слишком давно или произошла ошибка.

Пожалуйста, попробуйте создать новый счет.
`;
}

module.exports = {
    createPaymentMethodsMessage,
    createCardPaymentMessage,
    createStarsPaymentMessage,
    createCryptoPaymentMessage,
    createPaymentSuccessMessage,
    createPaymentWaitingMessage,
    createPaymentExpiredMessage,
    createPaymentUnknownStatusMessage,
    createPaymentNotFoundMessage
};