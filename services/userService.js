// services/userService.js
const db = require('../config/db');
const queries = require('../config/queries');

// Функция для сохранения информации о пользователе
async function saveUser(userData) {
    const { user_id, chat_id, first_name, last_name, username, language_code, joined_at } = userData;

    try {
        const pool = db.getPool();
        const result = await pool.query(queries.userQueries.saveUser, [
            user_id, chat_id, first_name, last_name, username, language_code, joined_at
        ]);
        return result.rows[0];
    } catch (error) {
        console.error('Ошибка при сохранении пользователя:', error);
        throw error;
    }
}

// Активация подписки для пользователя
async function activateSubscription(userId, tariffName, paymentDetails) {
    try {
        const pool = db.getPool();

        // Определяем срок действия подписки (1 месяц от текущей даты)
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 1);

        // Активируем подписку
        const result = await pool.query(
            queries.userQueries.activateSubscription,
            [
                userId,
                tariffName,
                now,
                endDate,
                paymentDetails.payment_id || null,
                paymentDetails.payment_method || null,
                paymentDetails.payment_amount || null
            ]
        );

        return result.rows[0];
    } catch (error) {
        console.error('Ошибка при активации подписки:', error);
        throw error;
    }
}

// Получение активной подписки пользователя
async function getUserActiveSubscription(userId) {
    try {
        const pool = db.getPool();
        const result = await pool.query(queries.userQueries.getActiveSubscription, [userId]);

        return result.rows[0] || null;
    } catch (error) {
        console.error('Ошибка при получении подписки пользователя:', error);
        throw error;
    }
}

// Проверка истекших подписок
async function deactivateExpiredSubscriptions() {
    try {
        const pool = db.getPool();
        const result = await pool.query(queries.userQueries.deactivateExpiredSubscriptions);

        return result.rows;
    } catch (error) {
        console.error('Ошибка при деактивации истекших подписок:', error);
        throw error;
    }
}

// Логирование использования ресурсов
async function logResourceUsage(userId, resourceType, count = 1) {
    try {
        const pool = db.getPool();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Проверяем, есть ли запись для сегодняшнего дня
        const checkResult = await pool.query(queries.userQueries.checkDailyUsage, [userId, today]);

        if (checkResult.rows.length === 0) {
            // Создаем новую запись для сегодняшнего дня
            await pool.query(queries.userQueries.createDailyUsage, [userId, today]);
        }

        // Обновляем соответствующий счетчик
        let updateQuery;
        if (resourceType === 'photo') {
            updateQuery = queries.userQueries.updatePhotoUsage;
        } else if (resourceType === 'document') {
            updateQuery = queries.userQueries.updateDocumentUsage;
        } else if (resourceType === 'ai_request') {
            updateQuery = queries.userQueries.updateAiRequestUsage;
        } else {
            throw new Error(`Неизвестный тип ресурса: ${resourceType}`);
        }

        await pool.query(updateQuery, [count, userId, today]);

        return true;
    } catch (error) {
        console.error('Ошибка при логировании использования ресурсов:', error);
        throw error;
    }
}

// Получение статистики использования ресурсов за месяц
async function getMonthlyUsageStats(userId) {
    try {
        const pool = db.getPool();
        const result = await pool.query(queries.userQueries.getUsageStats, [userId]);

        // Если записей нет, возвращаем нулевые значения
        return result.rows[0] || { total_photos: 0, total_documents: 0, total_ai_requests: 0 };
    } catch (error) {
        console.error('Ошибка при получении статистики использования:', error);
        throw error;
    }
}

// Проверка, не превышены ли лимиты пользователя
async function checkUserLimits(userId, resourceType) {
    try {
        // Создаем стандартные лимиты для случая, если что-то пойдет не так
        const defaultLimits = {
            monthly_photos: 1,
            monthly_documents: 1,
            monthly_ai_requests: -1,
            is_priority_support: false
        };

        // Получаем активную подписку пользователя
        const subscription = await getUserActiveSubscription(userId);

        // Если нет активной подписки, используем лимиты бесплатного тарифа
        let limits;
        if (!subscription) {
            try {
                // Получаем лимиты бесплатного тарифа
                const pool = db.getPool();
                const limitsResult = await pool.query(
                    queries.userQueries.getDefaultTariffLimits,
                    ['free'] // бесплатный тариф
                );

                // Проверяем, что результат существует и содержит данные
                if (!limitsResult.rows || limitsResult.rows.length === 0) {
                    console.warn('Не найдены лимиты для тарифа "free", пытаемся создать запись');

                    // Пробуем создать запись, если она не существует
                    try {
                        await pool.query(
                            queries.tariffQueries.insertTariffLimits,
                            [
                                'free',
                                1, // photos
                                1, // documents
                                -1, // ai_requests (-1 = безлимитно)
                                false, // priority_support
                                JSON.stringify({ feature1: 'basic' }) // features
                            ]
                        );

                        // Пробуем получить созданную запись
                        const newLimitsResult = await pool.query(
                            queries.userQueries.getDefaultTariffLimits,
                            ['free']
                        );

                        if (newLimitsResult.rows && newLimitsResult.rows.length > 0) {
                            limits = newLimitsResult.rows[0];
                        } else {
                            // Если все еще не можем получить, используем значения по умолчанию
                            console.warn('Не удалось получить созданные лимиты, используем значения по умолчанию');
                            limits = defaultLimits;
                        }
                    } catch (createError) {
                        console.error('Ошибка при создании записи тарифа "free":', createError);
                        limits = defaultLimits;
                    }
                } else {
                    limits = limitsResult.rows[0];
                }
            } catch (dbError) {
                console.error('Ошибка при получении лимитов из БД:', dbError);
                limits = defaultLimits;
            }
        } else {
            limits = subscription;
        }

        // Проверяем, что limits содержит все необходимые поля
        if (!limits || typeof limits !== 'object') {
            console.error('Объект limits отсутствует или имеет неверный формат, используем значения по умолчанию');
            limits = defaultLimits;
        }

        if (limits.monthly_photos === undefined) limits.monthly_photos = defaultLimits.monthly_photos;
        if (limits.monthly_documents === undefined) limits.monthly_documents = defaultLimits.monthly_documents;
        if (limits.monthly_ai_requests === undefined) limits.monthly_ai_requests = defaultLimits.monthly_ai_requests;

        // Получаем текущее использование
        const usage = await getMonthlyUsageStats(userId);

        // Проверяем лимиты в зависимости от типа ресурса
        if (resourceType === 'photo') {
            // Если лимит -1, то это безлимитный план
            if (limits.monthly_photos === -1) {
                return {
                    canUse: true,
                    current: usage.total_photos || 0,
                    limit: 'безлимитно'
                };
            }

            return {
                canUse: (usage.total_photos || 0) < limits.monthly_photos,
                current: usage.total_photos || 0,
                limit: limits.monthly_photos
            };
        } else if (resourceType === 'document') {
            if (limits.monthly_documents === -1) {
                return {
                    canUse: true,
                    current: usage.total_documents || 0,
                    limit: 'безлимитно'
                };
            }

            return {
                canUse: (usage.total_documents || 0) < limits.monthly_documents,
                current: usage.total_documents || 0,
                limit: limits.monthly_documents
            };
        } else if (resourceType === 'ai_request') {
            if (limits.monthly_ai_requests === -1) {
                return {
                    canUse: true,
                    current: usage.total_ai_requests || 0,
                    limit: 'безлимитно'
                };
            }

            return {
                canUse: (usage.total_ai_requests || 0) < limits.monthly_ai_requests,
                current: usage.total_ai_requests || 0,
                limit: limits.monthly_ai_requests
            };
        }

        return { canUse: false, error: 'Неизвестный тип ресурса' };
    } catch (error) {
        console.error('Ошибка при проверке лимитов пользователя:', error);
        // При ошибке разрешаем использование с базовыми лимитами
        return {
            canUse: true,
            current: 0,
            limit: 1,
            error: 'Ошибка проверки лимитов, применен базовый лимит'
        };
    }
}
// Получение информации о доступных ресурсах пользователя
// Получение информации о доступных ресурсах пользователя
async function getUserResourcesInfo(userId) {
    try {
        // Определяем стандартные значения на случай ошибок
        const defaultLimits = {
            monthly_photos: 1,
            monthly_documents: 1,
            monthly_ai_requests: -1,
            is_priority_support: false,
            other_features: {}
        };

        // Получаем активную подписку
        const subscription = await getUserActiveSubscription(userId);

        // Получаем текущее использование
        const usage = await getMonthlyUsageStats(userId);

        // Если нет активной подписки, используем лимиты бесплатного тарифа
        let limits;
        if (!subscription) {
            try {
                const pool = db.getPool();
                const limitsResult = await pool.query(
                    queries.userQueries.getDefaultTariffLimits,
                    ['free'] // бесплатный тариф
                );

                if (!limitsResult.rows || limitsResult.rows.length === 0) {
                    console.warn('Не найдены лимиты для тарифа "free" в getUserResourcesInfo, используем значения по умолчанию');
                    limits = defaultLimits;
                } else {
                    limits = limitsResult.rows[0];
                }
            } catch (dbError) {
                console.error('Ошибка при получении лимитов в getUserResourcesInfo:', dbError);
                limits = defaultLimits;
            }

            // Проверяем наличие всех необходимых полей
            if (!limits.monthly_photos) limits.monthly_photos = defaultLimits.monthly_photos;
            if (!limits.monthly_documents) limits.monthly_documents = defaultLimits.monthly_documents;
            if (!limits.monthly_ai_requests) limits.monthly_ai_requests = defaultLimits.monthly_ai_requests;
            if (!limits.is_priority_support) limits.is_priority_support = defaultLimits.is_priority_support;
            if (!limits.other_features) limits.other_features = defaultLimits.other_features;

            return {
                tariff: 'free',
                tariffDisplayName: 'Бесплатный',
                isActive: false,
                endDate: null,
                photos: {
                    used: usage.total_photos || 0,
                    limit: limits.monthly_photos,
                    remaining: Math.max(0, limits.monthly_photos - (usage.total_photos || 0))
                },
                documents: {
                    used: usage.total_documents || 0,
                    limit: limits.monthly_documents,
                    remaining: Math.max(0, limits.monthly_documents - (usage.total_documents || 0))
                },
                aiRequests: {
                    used: usage.total_ai_requests || 0,
                    limit: limits.monthly_ai_requests === -1 ? 'безлимитно' : limits.monthly_ai_requests,
                    remaining: limits.monthly_ai_requests === -1 ? 'безлимитно' :
                        Math.max(0, limits.monthly_ai_requests - (usage.total_ai_requests || 0))
                },
                prioritySupport: limits.is_priority_support,
                otherFeatures: limits.other_features || {}
            };
        }

        // Проверяем данные активной подписки на полноту
        if (!subscription.monthly_photos) subscription.monthly_photos = defaultLimits.monthly_photos;
        if (!subscription.monthly_documents) subscription.monthly_documents = defaultLimits.monthly_documents;
        if (!subscription.monthly_ai_requests) subscription.monthly_ai_requests = defaultLimits.monthly_ai_requests;
        if (subscription.is_priority_support === undefined) subscription.is_priority_support = defaultLimits.is_priority_support;
        if (!subscription.other_features) subscription.other_features = defaultLimits.other_features;

        // Функция для расчета оставшихся ресурсов (учитывая безлимитные планы)
        const calculateRemaining = (used, limit) => {
            if (limit === -1) return 'безлимитно';
            const remaining = limit - (used || 0);
            return Math.max(0, remaining);
        };

        return {
            tariff: subscription.tariff_name,
            tariffDisplayName: subscription.tariff_name.charAt(0).toUpperCase() + subscription.tariff_name.slice(1),
            isActive: true,
            endDate: subscription.end_date,
            photos: {
                used: usage.total_photos || 0,
                limit: subscription.monthly_photos === -1 ? 'безлимитно' : subscription.monthly_photos,
                remaining: calculateRemaining(usage.total_photos || 0, subscription.monthly_photos)
            },
            documents: {
                used: usage.total_documents || 0,
                limit: subscription.monthly_documents === -1 ? 'безлимитно' : subscription.monthly_documents,
                remaining: calculateRemaining(usage.total_documents || 0, subscription.monthly_documents)
            },
            aiRequests: {
                used: usage.total_ai_requests || 0,
                limit: subscription.monthly_ai_requests === -1 ? 'безлимитно' : subscription.monthly_ai_requests,
                remaining: calculateRemaining(usage.total_ai_requests || 0, subscription.monthly_ai_requests)
            },
            prioritySupport: subscription.is_priority_support,
            otherFeatures: subscription.other_features || {}
        };
    } catch (error) {
        console.error('Ошибка при получении информации о ресурсах пользователя:', error);
        // Возвращаем базовую информацию в случае ошибки
        return {
            tariff: 'free',
            tariffDisplayName: 'Бесплатный',
            isActive: false,
            endDate: null,
            photos: { used: 0, limit: 1, remaining: 1 },
            documents: { used: 0, limit: 1, remaining: 1 },
            aiRequests: { used: 0, limit: 'безлимитно', remaining: 'безлимитно' },
            prioritySupport: false,
            otherFeatures: {},
            error: 'Произошла ошибка при получении данных'
        };
    }
}

module.exports = {
    saveUser,
    activateSubscription,
    getUserActiveSubscription,
    deactivateExpiredSubscriptions,
    logResourceUsage,
    getMonthlyUsageStats,
    checkUserLimits,
    getUserResourcesInfo
};