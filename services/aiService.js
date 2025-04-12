// services/aiService.js
const axios = require('axios');
require('dotenv').config();

class AIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.client = axios.create({
            baseURL: 'https://api.openai.com/v1',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async processRequest(prompt, imageUrl = null) {
        try {
            // Выбираем модель в зависимости от наличия изображения
            const model = imageUrl ? "gpt-4-vision-preview" : "gpt-3.5-turbo";

            // Формируем сообщения в зависимости от наличия изображения
            let messages;

            if (imageUrl) {
                messages = [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: { url: imageUrl }
                        }
                    ]
                }];
            } else {
                messages = [{ role: "user", content: prompt }];
            }

            // Параметры запроса
            const requestData = {
                model: model,
                messages: messages,
                max_tokens: 4000
            };

            // Если используем vision, добавляем максимальную детализацию для изображений
            if (imageUrl) {
                requestData.max_tokens = 4000;
            }

            const response = await this.client.post('/chat/completions', requestData);

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('AI Request Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new AIService();