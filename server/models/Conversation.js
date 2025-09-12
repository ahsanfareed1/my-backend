const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageContent: {
    type: String,
    maxlength: 100
  },
  lastMessageTime: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    customer: {
      type: Number,
      default: 0
    },
    businessOwner: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// indexes for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ businessId: 1 });
conversationSchema.index({ lastActivity: -1 });

// virtual for conversation title
conversationSchema.virtual('title').get(function() {
  return `Chat with ${this.businessId?.businessName || 'Business'}`;
});

// generating conversation ID
conversationSchema.statics.generateConversationId = function(customerId, businessId) {
  return `conv_${customerId}_${businessId}`;
};

// updating last message info
conversationSchema.methods.updateLastMessage = function(messageId, content) {
  this.lastMessage = messageId;
  this.lastMessageContent = content;
  this.lastMessageTime = new Date();
  this.lastActivity = new Date();
  return this.save();
};

// increasing unread count
conversationSchema.methods.incrementUnreadCount = function(userId) {
  if (this.customer.toString() === userId.toString()) {
    this.unreadCount.customer += 1;
  } else if (this.businessOwner.toString() === userId.toString()) {
    this.unreadCount.businessOwner += 1;
  }
  return this.save();
};

// resetting unread count
conversationSchema.methods.resetUnreadCount = function(userId) {
  if (this.customer.toString() === userId.toString()) {
    this.unreadCount.customer = 0;
  } else if (this.businessOwner.toString() === userId.toString()) {
    this.unreadCount.businessOwner = 0;
  }
  return this.save();
};

// finding or creating conversation
conversationSchema.statics.findOrCreateConversation = async function(customerId, businessId) {
  const conversationId = this.generateConversationId(customerId, businessId);
  
  let conversation = await this.findOne({ conversationId });
  
  if (!conversation) {
    // getting business owner ID from business
    const Business = require('./Business');
    const business = await Business.findById(businessId);
    
    if (!business) {
      throw new Error('Business not found');
    }
    
    conversation = new this({
      conversationId,
      participants: [customerId, business.owner],
      businessId,
      customer: customerId,
      businessOwner: business.owner
    });
    
    await conversation.save();
  }
  
  return conversation;
};

// getting user conversations
conversationSchema.statics.getUserConversations = function(userId, page = 1, limit = 20) {
  return this.find({
    participants: userId,
    isActive: true
  })
  .sort({ lastActivity: -1 })
  .skip((page - 1) * limit)
  .limit(limit)
  .populate('businessId', 'businessName businessType images.logo')
  .populate('customer', 'firstName lastName profilePicture')
  .populate('businessOwner', 'firstName lastName profilePicture')
  .populate('lastMessage', 'content createdAt');
};

module.exports = mongoose.model('Conversation', conversationSchema);
