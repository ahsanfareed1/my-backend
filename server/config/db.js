const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI || 'mongodb://localhost:27017/aaa_services';
    
    const options = {
      // connection pooling settings
      maxPoolSize: process.env.NODE_ENV === 'production' ? 10 : 5,
      minPoolSize: process.env.NODE_ENV === 'production' ? 2 : 1,
      

      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      
      // write concern
      w: 'majority',
      
      // retry settings
      retryWrites: true,
      retryReads: true,
      
      // buffer settings
      bufferCommands: false,
      
      // auto index creation
      autoIndex: true
    };

    const conn = await mongoose.connect(mongoUri, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🔌 Connection State: ${conn.connection.readyState}`);
    console.log(`🌐 Connection Type: ${mongoUri.includes('localhost') ? 'Local MongoDB' : 'MongoDB Atlas'}`);
    
    // handling connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
    // graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during MongoDB disconnection:', err);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('💡 Please check your MongoDB connection settings:');
    console.error('   - For local MongoDB: MONGO_URI_LOCAL=mongodb://localhost:27017/aaa_services');
    console.error('   - For MongoDB Atlas: MONGO_URI=mongodb+srv://...');
    console.error('   - Make sure local MongoDB is running on port 27017');
    process.exit(1);
  }
};

module.exports = connectDB;
