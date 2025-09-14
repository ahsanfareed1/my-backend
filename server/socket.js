const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');

// keeping track of who is online
const connectedUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId

// checking if user is logged in before connecting
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // storing user info in socket for later use
    socket.userId = user._id.toString();
    socket.userType = user.userType;
    socket.user = user;
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

// setting up socket.io server
const initializeSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // using our auth middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    
    
    // adding user to our online list
    connectedUsers.set(socket.userId, socket.id);
    userSockets.set(socket.id, socket.userId);
    
    

    // if something goes wrong with this socket
    socket.on('error', (error) => {
      
    });

    // putting user in their own room
    socket.join(`user_${socket.userId}`);

    // business owners can join their business room
    if (socket.userType === 'business') {
      socket.on('join-business', async (businessId) => {
        try {
          const Business = require('./models/Business');
          const business = await Business.findOne({ owner: socket.userId });
          
          if (business && business._id.toString() === businessId) {
            socket.join(`business_${businessId}`);
            
          }
        } catch (error) {
          console.error('Error joining business room:', error);
        }
      });
    }

    // when someone sends a message
    socket.on('send-message', async (data) => {
      if (!data) {
        console.warn('⚠️ send-message received null data from user:', socket.userId);
        socket.emit('message-error', { message: 'Invalid message data' });
        return;
      }
      
      try {
        const { receiverId, businessId, content, messageType = 'text', attachments = [] } = data;
        
        

        // checking if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
          socket.emit('message-error', { message: 'Receiver not found' });
          return;
        }

        // finding or creating conversation
        // always use customerId first to keep conversation IDs same
        let conversation;
        if (socket.user.userType === 'business') {
          // if business owner sending, find conversation by customerId
          conversation = await Conversation.findOne({ 
            businessId, 
            businessOwner: socket.userId 
          });
          
          if (!conversation) {
            // create new conversation with customer as first participant
            conversation = await Conversation.findOrCreateConversation(receiverId, businessId);
          }
        } else {
          // if customer sending, use normal flow
          conversation = await Conversation.findOrCreateConversation(socket.userId, businessId);
        }
        
        
        
        // it will create message
        const message = new Message({
          conversationId: conversation.conversationId,
          sender: socket.userId,
          receiver: receiverId,
          businessId,
          content,
          messageType,
          attachments
        });

        await message.save();

        // updating conversation with last message
        await conversation.updateLastMessage(message._id, content);
        await conversation.incrementUnreadCount(receiverId);

        // getting user details for the message
        await message.populate('sender', 'firstName lastName profilePicture userType');
        await message.populate('receiver', 'firstName lastName profilePicture userType');
        await message.populate('businessId', 'businessName businessType images.logo');

        // telling sender that message was sent
        socket.emit('message-sent', {
          message,
          conversationId: conversation.conversationId
        });

        // sending message to receiver if they are online
        const receiverSocketId = connectedUsers.get(receiverId);
        
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new-message', {
            message,
            conversationId: conversation.conversationId,
            sender: socket.user
          });
          
          // not sending to personal room to avoid duplicate messages
        }

        // if receiver is business owner, also send to business room
        if (receiver.userType === 'business') {
          io.to(`business_${businessId}`).emit('business-message', {
            message,
            conversationId: conversation.conversationId,
            sender: socket.user
          });
        }

        

      } catch (error) {
        
        socket.emit('message-error', { 
          message: 'Failed to send message',
          error: error.message 
        });
      }
    });

    // when someone marks message as read
    socket.on('mark-read', async (data) => {
      if (!data) {
        
        socket.emit('mark-read-error', { message: 'Invalid data' });
        return;
      }
      
      try {
        const { messageId, conversationId } = data;
        
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('mark-read-error', { message: 'Message not found' });
          return;
        }

        // only receiver can mark message as read
        if (message.receiver.toString() === socket.userId) {
          await message.markAsRead();
          
          // resetting unread count for this conversation
          const conversation = await Conversation.findOne({ conversationId });
          if (conversation) {
            await conversation.resetUnreadCount(socket.userId);
          }

          // telling sender that message was read
          const senderSocketId = connectedUsers.get(message.sender.toString());
          if (senderSocketId) {
            io.to(senderSocketId).emit('message-read', {
              messageId,
              conversationId,
              readBy: socket.userId,
              readAt: message.readAt
            });
          }

          socket.emit('mark-read-success', { messageId, conversationId });
        }

      } catch (error) {
        console.error('Error marking message as read:', error);
        socket.emit('mark-read-error', { 
          message: 'Failed to mark message as read',
          error: error.message 
        });
      }
    });

    // handling typing indicators
    socket.on('typing-start', (data) => {
      if (!data) {
        
        return;
      }
      
      const { receiverId, businessId, conversationId } = data;
      
      if (!receiverId) {
        
        return;
      }
      
      const receiverSocketId = connectedUsers.get(receiverId);
      if (receiverSocketId) {
        // showing different typing text based on user type
        const typingText = socket.user.userType === 'business' 
          ? `${socket.user.firstName || 'Business'} is typing...`
          : `${socket.user.firstName} ${socket.user.lastName} is typing...`;
          
        io.to(receiverSocketId).emit('user-typing', {
          userId: socket.userId,
          userName: typingText,
          userType: socket.user.userType,
          businessId,
          conversationId
        });
      }
    });

    socket.on('typing-stop', (data) => {
      if (!data) {
        
        return;
      }
      
      const { receiverId, businessId, conversationId } = data;
      
      if (!receiverId) {
        
        return;
      }
      
      const receiverSocketId = connectedUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user-stopped-typing', {
          userId: socket.userId,
          businessId,
          conversationId
        });
      }
    });

    // when someone deletes a message
    socket.on('delete-message', async (data) => {
      if (!data) {
        
        socket.emit('delete-message-error', { message: 'Invalid data' });
        return;
      }
      
      try {
        const { messageId, conversationId } = data;
        
        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('delete-message-error', { message: 'Message not found' });
          return;
        }

        // checking if user is part of this conversation
        const conversation = await Conversation.findOne({
          conversationId: message.conversationId,
          participants: socket.userId
        });
        
        if (!conversation) {
          socket.emit('delete-message-error', { message: 'Access denied to this message' });
          return;
        }

        // soft delete the message for this user only
        await message.softDeleteForUser(socket.userId);

        // telling other people in conversation about deletion
        const otherParticipants = conversation.participants.filter(p => p.toString() !== socket.userId);
        otherParticipants.forEach(participantId => {
          const participantSocketId = connectedUsers.get(participantId.toString());
          if (participantSocketId) {
            io.to(participantSocketId).emit('message-deleted', {
              messageId,
              conversationId,
              deletedBy: socket.userId
            });
          }
        });

        socket.emit('delete-message-success', { messageId, conversationId });
        

      } catch (error) {
        
        socket.emit('delete-message-error', { 
          message: 'Failed to delete message',
          error: error.message 
        });
      }
    });

    // when user changes their status
    socket.on('user-status', (status) => {
      socket.broadcast.emit('user-status-change', {
        userId: socket.userId,
        status,
        userType: socket.userType
      });
    });

    // when user disconnects
    socket.on('disconnect', (reason) => {
      
      
      // removing user from our online list
      connectedUsers.delete(socket.userId);
      userSockets.delete(socket.id);
      
      // telling everyone that user went offline
      socket.broadcast.emit('user-status-change', {
        userId: socket.userId,
        status: 'offline',
        userType: socket.userType
      });
    });
  });

  return io;
};

// getting list of online users
const getConnectedUsers = () => {
  return Array.from(connectedUsers.keys());
};

// checking if specific user is online
const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

// sending notification to specific user
const sendNotificationToUser = (userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    const io = require('./server').io; // getting io instance from server
    io.to(socketId).emit(event, data);
  }
};

module.exports = {
  initializeSocket,
  getConnectedUsers,
  isUserOnline,
  sendNotificationToUser
};
