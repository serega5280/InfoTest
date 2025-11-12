const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true
  },
  username: {
    type: String,
    default: null
  },
  firstName: {
    type: String,
    default: null
  },
  lastName: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: null
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  commandsUsed: [{
    command: String,
    timestamp: Date,
    ipAddress: String
  }],
  testsCompleted: {
    type: Number,
    default: 0
  },
  totalScore: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Обновляем lastActivity при сохранении
userSessionSchema.pre('save', function(next) {
  this.lastActivity = Date.now();
  next();
});

// Статические методы
userSessionSchema.statics.logCommand = function(userId, userInfo, command, ipAddress) {
  return this.findOneAndUpdate(
    { userId: userId },
    {
      $set: {
        username: userInfo.username,
        firstName: userInfo.first_name,
        lastName: userInfo.last_name,
        ipAddress: ipAddress, // Теперь здесь будет псевдо-IP
        lastActivity: new Date()
      },
      $push: {
        commandsUsed: {
          command: command,
          timestamp: new Date(),
          ipAddress: ipAddress
        }
      }
    },
    { upsert: true, new: true }
  );
};

userSessionSchema.statics.logTestCompletion = function(userId, score) {
  return this.findOneAndUpdate(
    { userId: userId },
    {
      $inc: {
        testsCompleted: 1,
        totalScore: score
      },
      $set: {
        lastActivity: new Date()
      }
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('UserSession', userSessionSchema);