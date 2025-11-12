const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

// Загружаем .env только в разработке
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
  console.log('🔧 Режим разработки: загружены переменные из .env');
} else {
  console.log('🚀 Продакшен режим: используются переменные окружения хостинга');
}

const connectDB = require('./config/database');
const Question = require('./models/Question');
const UserSession = require('./models/UserSession');
const { getClientInfo, formatLogMessage } = require('./utils/ipUtils');
const Notifier = require('./utils/notifier');

// Проверяем обязательные переменные
const requiredEnvVars = ['BOT_TOKEN', 'MONGODB_URI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Отсутствуют обязательные переменные окружения:', missingVars.join(', '));
  console.log('💡 На хостинге добавьте их в Environment Variables');
  console.log('💡 Локально создайте .env файл');
  process.exit(1);
}

// Остальной код бота без изменений...

// Подключение к базе данных
connectDB();

// Создание бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Инициализация системы уведомлений
const notifier = new Notifier(bot, process.env.MODERATOR_CHAT_ID);

// Хранилище для текущих тестов пользователей
const userSessions = new Map();

class TestSession {
  constructor(userId) {
    this.userId = userId;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.score = 0;
    this.inProgress = false;
    this.startTime = null;
  }

  startTest(questions) {
    this.questions = questions;
    this.currentQuestionIndex = 0;
    this.answers = [];
    this.score = 0;
    this.inProgress = true;
    this.startTime = new Date();
  }

  answerQuestion(answerIndex) {
    const currentQuestion = this.questions[this.currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    
    this.answers.push({
      questionIndex: this.currentQuestionIndex,
      answer: answerIndex,
      isCorrect: isCorrect,
      timestamp: new Date()
    });

    if (isCorrect) {
      this.score++;
    }

    this.currentQuestionIndex++;
    
    if (this.currentQuestionIndex >= this.questions.length) {
      this.inProgress = false;
      return false; // Тест завершен
    }
    
    return true; // Тест продолжается
  }

  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex];
  }

  getTestDuration() {
    if (!this.startTime) return 0;
    return Math.round((new Date() - this.startTime) / 1000); // в секундах
  }
}

// Логирование команды
async function logCommand(msg, command) {
  try {
    const userInfo = getClientInfo(msg);
    const logMessage = formatLogMessage(userInfo, `COMMAND: ${command}`);
    
    console.log(logMessage);

    // Сохраняем в базу данных с псевдо-IP
    await UserSession.logCommand(
      msg.from.id,
      msg.from,
      command,
      userInfo.pseudoIP // Используем псевдо-IP вместо страны
    );

    // Отправляем уведомление модератору
    await notifier.notifyCommand(msg, command);

  } catch (error) {
    console.error('Ошибка при логировании:', error);
  }
}

// Логирование начала теста
async function logTestStart(msg) {
  try {
    const userInfo = getClientInfo(msg);
    const logMessage = formatLogMessage(userInfo, 'TEST_STARTED', {
      chatType: msg.chat.type
    });
    
    console.log(logMessage);

    // Отправляем уведомление модератору
    await notifier.notifyTestStart(msg);

  } catch (error) {
    console.error('Ошибка при логировании начала теста:', error);
  }
}

// Логирование завершения теста
async function logTestCompletion(msg, score, duration) {
  try {
    const userInfo = getClientInfo(msg);
    const logMessage = formatLogMessage(userInfo, 'TEST_COMPLETED', {
      score: score,
      duration: `${duration} сек.`,
      chatType: msg.chat.type
    });
    
    console.log(logMessage);

    // Сохраняем в базу данных
    await UserSession.logTestCompletion(msg.from.id, score);

    // Отправляем уведомление модератору
    await notifier.notifyTestCompletion(msg, score, duration);

  } catch (error) {
    console.error('Ошибка при логировании завершения теста:', error);
  }
}

// Команда для модератора - статистика
bot.onText(/\/admin_stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Проверяем, является ли пользователь модератором
  if (chatId.toString() !== process.env.MODERATOR_CHAT_ID) {
    return bot.sendMessage(chatId, '❌ У вас нет прав для этой команды.');
  }

  await notifier.sendBotStats();
});

// Команда для модератора - рассылка
bot.onText(/\/admin_broadcast (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const broadcastMessage = match[1];

  // Проверяем, является ли пользователь модератором
  if (chatId.toString() !== process.env.MODERATOR_CHAT_ID) {
    return bot.sendMessage(chatId, '❌ У вас нет прав для этой команды.');
  }

  try {
    const allUsers = await UserSession.distinct('userId');
    let successCount = 0;
    let errorCount = 0;

    for (const userId of allUsers) {
      try {
        await bot.sendMessage(userId, `📢 Сообщение от администратора:\n\n${broadcastMessage}`);
        successCount++;
        // Задержка чтобы не превысить лимиты Telegram API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        errorCount++;
      }
    }

    await bot.sendMessage(chatId, 
      `📢 Рассылка завершена:\n✅ Успешно: ${successCount}\n❌ Ошибок: ${errorCount}`
    );

  } catch (error) {
    console.error('Ошибка рассылки:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при рассылке сообщения');
  }
});

// Команда старта
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  await logCommand(msg, '/start');
  
  const welcomeMessage = `
🎓 Добро пожаловать в бот для тестирования по информатике!

Я помогу вам проверить ваши знания в области информатики.

Доступные команды:
/start - начать работу с ботом
/test - начать новый тест
/stats - посмотреть статистику
/help - получить справку

Нажмите /test чтобы начать тестирование!
  `;
  
  bot.sendMessage(chatId, welcomeMessage);
});

// Команда помощи
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  await logCommand(msg, '/help');
  
  const helpMessage = `
📚 Помощь по боту:

/test - Начать новый тест (10 случайных вопросов)
/start - Перезапустить бота
/stats - Посмотреть вашу статистику

Во время теста:
- Выбирайте вариант ответа от 1 до 4
- Тест можно пройти только один раз за сессию
- В конце вы получите результат и материалы для изучения
  `;
  
  bot.sendMessage(chatId, helpMessage);
});

// Команда статистики
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  await logCommand(msg, '/stats');

  try {
    const userSession = await UserSession.findOne({ userId: userId });
    
    if (!userSession) {
      return bot.sendMessage(chatId, '📊 У вас еще нет статистики. Пройдите тест командой /test');
    }

    const totalTests = userSession.testsCompleted;
    const averageScore = totalTests > 0 ? Math.round(userSession.totalScore / totalTests) : 0;
    const totalCommands = userSession.commandsUsed.length;
    const lastActivity = userSession.lastActivity.toLocaleString('ru-RU');

    const statsMessage = `
📊 Ваша статистика:

✅ Пройдено тестов: ${totalTests}
📈 Средний балл: ${averageScore}/10
🔄 Всего команд: ${totalCommands}
⏰ Последняя активность: ${lastActivity}
🌍 Регион: ${userSession.ipAddress}

Продолжайте учиться! 🎓
    `;

    bot.sendMessage(chatId, statsMessage);

  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    bot.sendMessage(chatId, '❌ Ошибка при получении статистики');
  }
});

// Начало теста
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  await logCommand(msg, '/test');
  await logTestStart(msg);

  try {
    // Проверяем, не проходит ли пользователь уже тест
    if (userSessions.has(userId) && userSessions.get(userId).inProgress) {
      return bot.sendMessage(chatId, '⚠️ Вы уже проходите тест! Закончите текущий тест прежде чем начать новый.');
    }

    // Получаем 10 случайных вопросов
    const questions = await Question.aggregate([{ $sample: { size: 10 } }]);
    
    if (questions.length === 0) {
      return bot.sendMessage(chatId, '❌ В базе данных нет вопросов. Обратитесь к администратору.');
    }

    // Создаем или обновляем сессию пользователя
    let testSession = userSessions.get(userId);
    if (!testSession) {
      testSession = new TestSession(userId);
      userSessions.set(userId, testSession);
    }

    testSession.startTest(questions);
    await sendQuestion(chatId, testSession);

  } catch (error) {
    console.error('Ошибка при начале теста:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка при загрузке вопросов. Попробуйте позже.');
  }
});

// Обработка ответов (без изменений)
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const answerIndex = parseInt(callbackQuery.data);

  const testSession = userSessions.get(userId);
  
  if (!testSession || !testSession.inProgress) {
    return bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Сессия теста не активна. Начните новый тест командой /test'
    });
  }

  // Проверяем валидность ответа
  if (isNaN(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    return bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Неверный вариант ответа'
    });
  }

  // Обрабатываем ответ
  const hasMoreQuestions = testSession.answerQuestion(answerIndex);
  
  if (hasMoreQuestions) {
    // Показываем следующий вопрос
    await sendQuestion(chatId, testSession);
  } else {
    // Завершаем тест и показываем результаты
    const duration = testSession.getTestDuration();
    await logTestCompletion(msg, testSession.score, duration);
    await showResults(chatId, testSession);
    userSessions.delete(userId); // Очищаем сессию
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// Функция отправки вопроса (без изменений)
async function sendQuestion(chatId, testSession) {
  const question = testSession.getCurrentQuestion();
  const questionNumber = testSession.currentQuestionIndex + 1;
  const totalQuestions = testSession.questions.length;

  const message = `
❓ Вопрос ${questionNumber}/${totalQuestions}:

${question.question}

Варианты ответов:
1. ${question.options[0]}
2. ${question.options[1]}
3. ${question.options[2]}
4. ${question.options[3]}

Выберите номер правильного ответа (1-4):
  `;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '1', callback_data: '0' },
          { text: '2', callback_data: '1' }
        ],
        [
          { text: '3', callback_data: '2' },
          { text: '4', callback_data: '3' }
        ]
      ]
    }
  };

  await bot.sendMessage(chatId, message, options);
}

// Функция показа результатов (без изменений)
async function showResults(chatId, testSession) {
  const totalQuestions = testSession.questions.length;
  const score = testSession.score;
  const percentage = Math.round((score / totalQuestions) * 100);

  let resultMessage = `
🎯 Тест завершен!

Ваш результат: ${score} из ${totalQuestions} (${percentage}%)

  `;

  // Добавляем оценку
  let grade;
  if (percentage >= 90) grade = 'Отлично! 🏆';
  else if (percentage >= 70) grade = 'Хорошо! 👍';
  else if (percentage >= 50) grade = 'Удовлетворительно 👌';
  else grade = 'Нужно подтянуть знания 📚';

  resultMessage += `Оценка: ${grade}\n\n`;

  // Добавляем материалы для изучения
  resultMessage += '📖 Материалы для повторения:\n\n';

  testSession.questions.forEach((question, index) => {
    const userAnswer = testSession.answers[index];
    const isCorrect = userAnswer.isCorrect;
    const emoji = isCorrect ? '✅' : '❌';
    
    resultMessage += `${emoji} Вопрос ${index + 1}: ${question.explanation}\n`;
    resultMessage += `🔗 Ссылка для изучения: ${question.studyLink}\n\n`;
  });

  resultMessage += 'Для нового теста используйте команду /test';

  await bot.sendMessage(chatId, resultMessage);
}

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // Игнорируем команды (они обрабатываются отдельно)
  if (text.startsWith('/')) return;

  // Логируем текстовые сообщения
  const userInfo = getClientInfo(msg);
  const logMessage = formatLogMessage(userInfo, `TEXT_MESSAGE: "${text}"`);
  console.log(logMessage);

  // Отправляем уведомление модератору о текстовом сообщении
  await notifier.notifyTextMessage(msg);

  const testSession = userSessions.get(userId);
  
  if (testSession && testSession.inProgress) {
    bot.sendMessage(chatId, 'Пожалуйста, используйте кнопки для выбора ответа.');
  }
});

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Отправляем уведомление о запуске бота модератору
setTimeout(async () => {
  await notifier.sendToModerator('🤖 <b>Бот запущен и готов к работе!</b>', { parse_mode: 'HTML' });
  await notifier.sendBotStats();
}, 3000);

// Логирование запуска бота
console.log('🤖 Бот запущен...');
console.log('=================================');
console.log('📝 Логирование активности пользователей:');
console.log('=================================');