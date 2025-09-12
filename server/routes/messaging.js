const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// getting all conversations for user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversations = await Conversation.getUserConversations(userId);
    
    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
});

// starting new conversation with business
router.post('/conversations/:businessId/start', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.userId;
    
    
    
    // finding or creating conversation
    const conversation = await Conversation.findOrCreateConversation(userId, businessId);
    
    
    
    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start conversation',
      error: error.message
    });
  }
});

// getting messages from conversation
router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    // checking if user is part of this conversation
    const conversation = await Conversation.findOne({ 
      conversationId,
      participants: userId 
    });
    
    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }
    
    // getting messages
    const messages = await Message.getConversationMessages(conversationId, userId);
    
    res.json({
      success: true,
      messages: messages.reverse() // showing oldest first
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// marking message as read
router.post('/mark-read', authenticateToken, async (req, res) => {
  try {
    const { messageId, conversationId } = req.body;
    const userId = req.user.userId;
    
    
    
    // checking if user is part of this conversation
    const conversation = await Conversation.findOne({
      conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }
    
    // finding the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // only receiver can mark message as read
    if (message.receiver.toString() === userId.toString()) {
      await message.markAsRead();
      
      // resetting unread count for this conversation
      await conversation.resetUnreadCount(userId);
      
      
      
      res.json({
        success: true,
        message: 'Message marked as read'
      });
    } else {
      res.status(403).json({
        success: false,
        message: 'You can only mark messages you received as read'
      });
    }
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
});

// getting total unread messages count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // getting all conversations for user
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    });
    
    // calculating total unread count
    let unreadCount = 0;
    conversations.forEach(conv => {
      if (conv.customer.toString() === userId.toString()) {
        unreadCount += conv.unreadCount.customer || 0;
      } else if (conv.businessOwner.toString() === userId.toString()) {
        unreadCount += conv.unreadCount.businessOwner || 0;
      }
    });
    
    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message
    });
  }
});

// marking all messages in conversation as read
router.post('/conversations/:conversationId/mark-read', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    
    
    // checking if user is part of this conversation
    const conversation = await Conversation.findOne({
      conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }
    
    // marking all unread messages in this conversation as read
    const unreadMessages = await Message.find({
      conversationId,
      receiver: userId,
      isRead: false
    });
    
    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map(msg => msg.markAsRead())
      );
      
      // resetting unread count for this conversation
      await conversation.resetUnreadCount(userId);
      
      
    }
    
    res.json({
      success: true,
      message: 'Conversation marked as read',
      messagesMarked: unreadMessages.length
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark conversation as read',
      error: error.message
    });
  }
});

// deleting specific message
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;
    
    
    
    // finding the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // checking if user is part of this conversation
    const conversation = await Conversation.findOne({ 
      conversationId: message.conversationId,
      participants: userId 
    });
    
    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
      });
    }
    
    // soft delete the message for this user
    await message.softDeleteForUser(userId);
    
    
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// deleting conversation for user
router.delete('/conversations/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    
    
    // checking if user is part of this conversation
    const conversation = await Conversation.findOne({ 
      conversationId,
      participants: userId 
    });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    // soft delete all messages in this conversation for this user
    const messages = await Message.find({ conversationId });
    await Promise.all(
      messages.map(msg => msg.softDeleteForUser(userId))
    );
    
    
    
    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: error.message
    });
  }
});

module.exports = router;
