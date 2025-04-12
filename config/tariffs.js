// config/tariffs.js
/**
 * Конфигурация тарифных планов
 */
module.exports = {
    free: {
        displayName: 'Бесплатный',
        description: 'Базовый доступ',
        limits: {
            photos: 1,
            documents: 1,
            ai_requests: -1 // -1 = безлимитно
        },
        prices: {
            rub: 0,
            stars: 0
        },
        features: []
    },
    silver: {
        displayName: 'Silver',
        description: 'Правовой старт',
        limits: {
            photos: 50,
            documents: 20,
            ai_requests: 100
        },
        prices: {
            rub: 199,
            stars: 99
        },
        features: ['Доступ к базе шаблонов документов']
    },
    gold: {
        displayName: 'Gold',
        description: 'Правовая защита+',
        limits: {
            photos: 150,
            documents: 50,
            ai_requests: 300
        },
        prices: {
            rub: 370,
            stars: 180
        },
        features: [
            'Доступ к базе шаблонов документов',
            'Приоритетная обработка запросов'
        ],
        priority_support: true
    },
    platinum: {
        displayName: 'Platinum',
        description: 'Премиум консультант',
        limits: {
            photos: 500,
            documents: 100,
            ai_requests: 1000
        },
        prices: {
            rub: 599,
            stars: 299
        },
        features: [
            'Неограниченный анализ документов',
            'Углубленный анализ сложных ситуаций',
            'Специальные правовые рекомендации'
        ],
        priority_support: true
    },
    diamond: {
        displayName: 'Diamond',
        description: 'Личный юрист',
        limits: {
            photos: -1, // безлимитно
            documents: -1, // безлимитно
            ai_requests: -1 // безлимитно
        },
        prices: {
            rub: 999,
            stars: 490
        },
        features: [
            'Полностью неограниченный доступ',
            'Персональные юридические рекомендации',
            'Премиум поддержка'
        ],
        priority_support: true
    }
};