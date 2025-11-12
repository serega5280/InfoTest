const TelegramBot = require('node-telegram-bot-api');

class Notifier {
  constructor(botInstance, moderatorChatId) {
    this.bot = botInstance;
    this.moderatorChatId = moderatorChatId;
    this.enabled = moderatorChatId && moderatorChatId !== 'your_chat_id_here';
  }

  /**
   * Отправляет уведомление модератору
   */
  async sendToModerator(message, options = {}) {
    if (!this.enabled) {
      console.log('❌ MODERATOR: Уведомления отключены - не указан MODERATOR_CHAT_ID');
      return;
    }

    try {
      await this.bot.sendMessage(this.moderatorChatId, message, options);
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления модератору:', error.message);
    }
  }

  /**
   * Форматирует уведомление о действии пользователя
   */
  formatUserAction(userInfo, action, additionalData = {}) {
    const timestamp = new Date().toLocaleString('ru-RU');
    const userIdentifier = userInfo.username !== 'не указан' 
      ? `@${userInfo.username}` 
      : `${userInfo.firstName} ${userInfo.lastName}`.trim();

    let message = `👤 <b>Новое действие пользователя</b>\n`;
    message += `⏰ <b>Время:</b> ${timestamp}\n`;
    message += `👤 <b>Пользователь:</b> ${userIdentifier}\n`;
    message += `🆔 <b>ID:</b> <code>${userInfo.userId}</code>\n`;
    message += `🌍 <b>Страна:</b> ${userInfo.estimatedCountry}\n`;
    message += `📱 <b>Действие:</b> ${action}\n`;
    message += `🖥️ <b>IP:</b> <code>${userInfo.pseudoIP}</code>\n`; // Только IP, без региона

    if (additionalData.score !== undefined) {
      message += `📊 <b>Результат:</b> ${additionalData.score}/10\n`;
    }

    if (additionalData.duration) {
      message += `⏱️ <b>Длительность теста:</b> ${additionalData.duration} сек.\n`;
    }

    if (additionalData.text) {
      message += `✍️ <b>Текст:</b> ${additionalData.text}\n`;
    }

    return message;
  }

  /**
   * Отправляет уведомление о команде
   */
  async notifyCommand(msg, command) {
    const { getClientInfo } = require('./ipUtils');
    const userInfo = getClientInfo(msg);
    
    const message = this.formatUserAction(userInfo, `Команда: ${command}`);

    await this.sendToModerator(message, { parse_mode: 'HTML' });
  }

  /**
   * Отправляет уведомление о начале теста
   */
  async notifyTestStart(msg) {
    const { getClientInfo } = require('./ipUtils');
    const userInfo = getClientInfo(msg);
    
    const message = this.formatUserAction(userInfo, 'Начал тестирование');

    await this.sendToModerator(message, { parse_mode: 'HTML' });
  }

  /**
   * Отправляет уведомление о завершении теста
   */
  async notifyTestCompletion(msg, score, duration) {
    const { getClientInfo } = require('./ipUtils');
    const userInfo = getClientInfo(msg);
    
    const message = this.formatUserAction(userInfo, 'Завершил тестирование', {
      score: score,
      duration: duration
    });

    await this.sendToModerator(message, { parse_mode: 'HTML' });
  }

  /**
   * Отправляет уведомление о текстовом сообщении
   */
  async notifyTextMessage(msg) {
    const { getClientInfo } = require('./ipUtils');
    const userInfo = getClientInfo(msg);
    
    const message = this.formatUserAction(userInfo, 'Отправил сообщение', {
      text: msg.text
    });

    await this.sendToModerator(message, { parse_mode: 'HTML' });
  }

  /**
   * Отправляет статистику бота модератору
   */
  async sendBotStats() {
    const UserSession = require('../models/UserSession');
    
    try {
      const totalUsers = await UserSession.countDocuments();
      const activeUsers = await UserSession.countDocuments({ 
        lastActivity: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
      });
      const totalTests = await UserSession.aggregate([
        { $group: { _id: null, total: { $sum: '$testsCompleted' } } }
      ]);
      const totalTestsCount = totalTests[0]?.total || 0;

      const statsMessage = `
📊 <b>Статистика бота</b>

👥 Всего пользователей: <b>${totalUsers}</b>
🟢 Активных за 24ч: <b>${activeUsers}</b>
✅ Пройдено тестов: <b>${totalTestsCount}</b>
⏰ Обновлено: ${new Date().toLocaleString('ru-RU')}
      `.trim();

      await this.sendToModerator(statsMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Ошибка при получении статистики:', error);
    }
  }
}

module.exports = Notifier;