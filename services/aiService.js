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

    async processRequest(prompt) {
        try {
            const response = await this.client.post('/chat/completions', {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }]
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('AI Request Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new AIService();