// constants/paymentConstants.js
/**
 * Константы для платежных методов
 */
const PAYMENT_METHODS = {
    CRYPTO: 'crypto',
    STARS: 'stars',
    CARD: 'card'
};

/**
 * Константы для статусов платежей
 */
const PAYMENT_STATUSES = {
    PAID: 'paid',
    ACTIVE: 'active',
    EXPIRED: 'expired'
};

/**
 * Константы для типов действий с платежами
 */
const PAYMENT_ACTIONS = {
    PAY: 'pay',
    CHECK: 'check',
    INITIATE: 'initiate'
};

/**
 * Константы для типов обратных вызовов
 */
const CALLBACK_TYPES = {
    SUBSCRIPTION_MENU: 'subscription_menu',
    TARIFF: 'tariff_',
    SELECT: 'select_',
    PAY: 'pay_',
    CHECK_PAYMENT: 'check_payment_',
    CHECK_STARS_PAYMENT: 'check_stars_payment_',
    INITIATE_STARS_PAYMENT: 'initiate_stars_payment_',
    INITIATE_CARD_PAYMENT: 'initiate_card_payment_',
    BACK_TO_MAIN: 'back_to_main'
};

/**
 * Константы для типов ресурсов
 */
const RESOURCE_TYPES = {
    PHOTO: 'photo',
    DOCUMENT: 'document',
    AI_REQUEST: 'ai_request'
};

module.exports = {
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    PAYMENT_ACTIONS,
    CALLBACK_TYPES,
    RESOURCE_TYPES
};