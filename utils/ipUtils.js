/**
 * Получает информацию о клиенте из сообщения Telegram
 */
const getClientInfo = (msg) => {
  const userInfo = {
    userId: msg.from.id,
    username: msg.from.username || 'не указан',
    firstName: msg.from.first_name || 'не указан',
    lastName: msg.from.last_name || 'не указан',
    languageCode: msg.from.language_code || 'не указан',
    chatId: msg.chat.id,
    chatType: msg.chat.type,
    timestamp: new Date().toISOString(),
    isBot: msg.from.is_bot || false
  };

  // Определение страны по языку
  const countryFromLanguage = {
    'ru': 'Россия',
    'en': 'США/Великобритания',
    'de': 'Германия',
    'fr': 'Франция',
    'es': 'Испания',
    'it': 'Италия',
    'pt': 'Португалия',
    'zh': 'Китай',
    'ja': 'Япония',
    'ko': 'Корея',
    'ar': 'Арабские страны',
    'tr': 'Турция',
    'uk': 'Украина',
    'pl': 'Польша',
    'nl': 'Нидерланды'
  };

  userInfo.estimatedCountry = countryFromLanguage[msg.from.language_code] || 'Неизвестно';

  // Генерируем псевдо-IP
  userInfo.pseudoIP = generatePseudoIP(msg.from.id, msg.date);

  return userInfo;
};

/**
 * Генерирует псевдо-IP на основе ID пользователя и времени
 * Создает более реалистичные IP адреса
 */
function generatePseudoIP(userId, timestamp) {
  // Используем ID пользователя и время для генерации уникального IP
  const seed = userId + (timestamp || Date.now());
  
  // Генерируем 4 октета IP адреса
  const octet1 = 192 + (seed % 32);  // 192-223 - частные адреса
  const octet2 = (seed * 13) % 256;
  const octet3 = (seed * 17) % 256;
  const octet4 = (seed * 19) % 256;
  
  return `${octet1}.${octet2}.${octet3}.${octet4}`;
}

/**
 * Форматирует лог для вывода в консоль
 */
const formatLogMessage = (userInfo, action, additionalData = {}) => {
  const timestamp = new Date().toLocaleString('ru-RU');
  const userIdentifier = userInfo.username !== 'не указан' 
    ? `@${userInfo.username}` 
    : `${userInfo.firstName} ${userInfo.lastName}`;

  let message = `[${timestamp}] 👤 USER: ${userIdentifier} (ID: ${userInfo.userId})`;
  message += ` | 🌍 COUNTRY: ${userInfo.estimatedCountry}`;
  message += ` | 🖥️ IP: ${userInfo.pseudoIP}`;
  message += ` | 📱 ACTION: ${action}`;
  
  if (additionalData.score !== undefined) {
    message += ` | 📊 SCORE: ${additionalData.score}`;
  }

  return message;
};

/**
 * Получает расширенную информацию о пользователе для модератора
 */
const getExtendedUserInfo = (msg) => {
  const basicInfo = getClientInfo(msg);
  
  return {
    ...basicInfo,
    chatTitle: msg.chat.title || 'личный чат',
    messageId: msg.message_id,
    date: new Date(msg.date * 1000).toLocaleString('ru-RU')
  };
};

module.exports = {
  getClientInfo,
  getExtendedUserInfo,
  formatLogMessage
};