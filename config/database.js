const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI не указан в .env файле');
    }

    console.log('Подключение к MongoDB...');
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 секунд таймаут
      socketTimeoutMS: 45000, // 45 секунд таймаут
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
    
    // Более детальная информация об ошибке
    if (error.code === 'ENODATA') {
      console.log('\n🔧 Возможные решения:');
      console.log('1. Проверьте интернет-подключение');
      console.log('2. Убедитесь, что строка подключения верная');
      console.log('3. Проверьте настройки DNS');
      console.log('4. Попробуйте использовать другой DNS (Google DNS: 8.8.8.8)');
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;