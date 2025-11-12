const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Вопрос обязателен'],
    trim: true
  },
  options: {
    type: [String],
    required: [true, 'Варианты ответов обязательны'],
    validate: {
      validator: function(options) {
        return options.length === 4;
      },
      message: 'Должно быть 4 варианта ответа'
    }
  },
  correctAnswer: {
    type: Number,
    required: [true, 'Правильный ответ обязателен'],
    min: [0, 'Индекс ответа должен быть от 0 до 3'],
    max: [3, 'Индекс ответа должен быть от 0 до 3']
  },
  explanation: {
    type: String,
    required: [true, 'Объяснение обязательно'],
    trim: true
  },
  studyLink: {
    type: String,
    required: [true, 'Ссылка для изучения обязательна'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Категория обязательна'],
    enum: [
      'алгоритмы',
      'программирование', 
      'сети',
      'базы_данных',
      'операционные_системы',
      'структуры_данных',
      'основы',
      'информатика', // Добавляем новые категории
      'языки_программирования',
      'теория_информации',
      'компьютерные_науки'
    ],
    default: 'основы'
  },
  difficulty: {
    type: String,
    enum: ['легкий', 'средний', 'сложный'],
    default: 'средний'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Обновление updated_at при изменении
questionSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Статические методы
questionSchema.statics.getRandomQuestions = function(count = 10) {
  return this.aggregate([
    { $sample: { size: count } }
  ]);
};

questionSchema.statics.getByCategory = function(category, count = 10) {
  return this.aggregate([
    { $match: { category: category } },
    { $sample: { size: count } }
  ]);
};

module.exports = mongoose.model('Question', questionSchema);