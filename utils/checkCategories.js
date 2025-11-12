const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Question = require('../models/Question');
require('dotenv').config();

async function checkCategories() {
  try {
    await connectDB();
    
    // Получаем все допустимые категории из схемы
    const categoryEnum = Question.schema.path('category').enumValues;
    console.log('✅ Допустимые категории в схеме:');
    categoryEnum.forEach(cat => console.log(`   - ${cat}`));
    
    // Проверяем существующие вопросы на соответствие
    const questions = await Question.find();
    console.log(`\n🔍 Проверка ${questions.length} вопросов...`);
    
    const invalidQuestions = questions.filter(q => !categoryEnum.includes(q.category));
    
    if (invalidQuestions.length > 0) {
      console.log('\n❌ Найдены вопросы с недопустимыми категориями:');
      invalidQuestions.forEach(q => {
        console.log(`   Вопрос: "${q.question.substring(0, 50)}..."`);
        console.log(`   Категория: "${q.category}"`);
      });
    } else {
      console.log('\n✅ Все вопросы имеют допустимые категории!');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Ошибка при проверке категорий:', error);
    process.exit(1);
  }
}

checkCategories();