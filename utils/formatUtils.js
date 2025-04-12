// utils/formatUtils.js
/**
 * Форматирует название тарифа с заглавной буквы
 * @param {string} tariffName - Название тарифа
 * @returns {string} - Отформатированное название тарифа
 */
function formatTariffName(tariffName) {
    return tariffName.charAt(0).toUpperCase() + tariffName.slice(1);
}

/**
 * Форматирует цену в соответствии с валютой
 * @param {number} amount - Сумма
 * @param {string} currency - Валюта (RUB, XTR и т.д.)
 * @returns {string} - Отформатированная цена с символом валюты
 */
function formatPrice(amount, currency) {
    const currencySymbols = {
        RUB: '₽',
        XTR: 'Stars',
        USD: '$',
        EUR: '€'
    };

    const symbol = currencySymbols[currency] || currency;
    return `${amount} ${symbol}`;
}

/**
 * Форматирует дату в локальный формат
 * @param {Date|string} date - Дата
 * @returns {string} - Отформатированная дата
 */
function formatDate(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString();
}

module.exports = {
    formatTariffName,
    formatPrice,
    formatDate
};