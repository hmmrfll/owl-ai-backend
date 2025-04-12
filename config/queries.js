// config/queries.js
const createTables = {
    users: `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id BIGINT UNIQUE NOT NULL,
      chat_id BIGINT NOT NULL,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      username VARCHAR(255),
      language_code VARCHAR(10),
      joined_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `,

    subscriptions: `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(user_id),
      tariff_name VARCHAR(50) NOT NULL,
      start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      end_date TIMESTAMP NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      payment_id VARCHAR(255),
      payment_method VARCHAR(50),
      payment_amount NUMERIC(10, 2),
      UNIQUE (user_id, is_active)
    );
  `,

    usage_stats: `
    CREATE TABLE IF NOT EXISTS usage_stats (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(user_id),
      photos_used INT DEFAULT 0,
      documents_used INT DEFAULT 0,
      ai_requests INT DEFAULT 0,
      usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE (user_id, usage_date)
    );
  `,

    tariff_limits: `
    CREATE TABLE IF NOT EXISTS tariff_limits (
      id SERIAL PRIMARY KEY,
      tariff_name VARCHAR(50) NOT NULL UNIQUE,
      monthly_photos INT NOT NULL,
      monthly_documents INT NOT NULL, 
      monthly_ai_requests INT NOT NULL,
      is_priority_support BOOLEAN DEFAULT FALSE,
      other_features JSONB
    );
  `
};

const userQueries = {
    saveUser: `
    INSERT INTO users (user_id, chat_id, first_name, last_name, username, language_code, joined_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      chat_id = $2,
      first_name = $3,
      last_name = $4,
      username = $5,
      language_code = $6,
      updated_at = NOW()
    RETURNING *
  `,

    activateSubscription: `
    WITH deactivated AS (
      UPDATE subscriptions 
      SET is_active = FALSE 
      WHERE user_id = $1 AND is_active = TRUE
    )
    INSERT INTO subscriptions 
      (user_id, tariff_name, start_date, end_date, is_active, payment_id, payment_method, payment_amount) 
    VALUES 
      ($1, $2, $3, $4, TRUE, $5, $6, $7) 
    RETURNING *
  `,

    getActiveSubscription: `
    SELECT s.*, tl.* 
    FROM subscriptions s
    LEFT JOIN tariff_limits tl ON s.tariff_name = tl.tariff_name
    WHERE s.user_id = $1 AND s.is_active = TRUE AND s.end_date > CURRENT_TIMESTAMP
    ORDER BY s.start_date DESC LIMIT 1
  `,

    deactivateExpiredSubscriptions: `
    UPDATE subscriptions 
    SET is_active = FALSE 
    WHERE end_date < CURRENT_TIMESTAMP AND is_active = TRUE 
    RETURNING *
  `,

    getUsageStats: `
    SELECT 
      SUM(photos_used) as total_photos,
      SUM(documents_used) as total_documents,
      SUM(ai_requests) as total_ai_requests
    FROM usage_stats 
    WHERE user_id = $1 
    AND usage_date >= date_trunc('month', CURRENT_DATE)
  `,

    checkDailyUsage: `
    SELECT * FROM usage_stats 
    WHERE user_id = $1 AND usage_date = $2
  `,

    createDailyUsage: `
    INSERT INTO usage_stats (user_id, usage_date) 
    VALUES ($1, $2)
  `,

    updatePhotoUsage: `
    UPDATE usage_stats 
    SET photos_used = photos_used + $1 
    WHERE user_id = $2 AND usage_date = $3
  `,

    updateDocumentUsage: `
    UPDATE usage_stats 
    SET documents_used = documents_used + $1 
    WHERE user_id = $2 AND usage_date = $3
  `,

    updateAiRequestUsage: `
    UPDATE usage_stats 
    SET ai_requests = ai_requests + $1 
    WHERE user_id = $2 AND usage_date = $3
  `,

    getDefaultTariffLimits: `
    SELECT * FROM tariff_limits WHERE tariff_name = $1
  `
};

const tariffQueries = {
    insertTariffLimits: `
    INSERT INTO tariff_limits 
      (tariff_name, monthly_photos, monthly_documents, monthly_ai_requests, is_priority_support, other_features)
    VALUES 
      ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (tariff_name) 
    DO UPDATE SET 
      monthly_photos = $2,
      monthly_documents = $3,
      monthly_ai_requests = $4,
      is_priority_support = $5,
      other_features = $6
  `,

    getTariffCount: `
    SELECT COUNT(*) FROM tariff_limits
  `
};

module.exports = {
    createTables,
    userQueries,
    tariffQueries
};