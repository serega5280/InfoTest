const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Получаем URI из переменных окружения (для хостинга) или из .env (для локальной разработки)
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URL;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI не указан в переменных окружения');
    }

    console.log('🔗 Подключение к MongoDB...');
    console.log('📡 URI:', mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Скрываем логин и пароль в логах
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
    });

    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ Ошибка MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB отключена');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB соединение закрыто');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    
    // Детальная диагностика
    if (error.name === 'MongoServerSelectionError') {
      console.log('\n🔧 Возможные решения:');
      console.log('1. Проверьте строку подключения MongoDB');
      console.log('2. Убедитесь, что IP хостинга добавлен в whitelist MongoDB Atlas');
      console.log('3. Проверьте логин и пароль');
    } else if (error.message.includes('MONGODB_URI не указан')) {
      console.log('\n🔧 Настройте переменные окружения:');
      console.log('1. На хостинге: добавьте MONGODB_URI в Environment Variables');
      console.log('2. Локально: создайте .env файл с MONGODB_URI=ваша_строка_подключения');
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;