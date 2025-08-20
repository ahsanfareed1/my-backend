const mongoose = require('mongoose');
const Admin = require('./models/Admin');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const setupAdmins = async () => {
  try {
    console.log('🚀 Setting up default admin users...');
    
    // Initialize default admins
    await Admin.initializeDefaultAdmins();
    
    console.log('✅ Admin setup completed successfully!');
    console.log('\n📋 Default admin credentials:');
    console.log('Username: ahsanfareed, Password: Group@08');
    console.log('Username: Alikhan, Password: Group@08');
    console.log('Username: Alihaider, Password: Group@08');
    console.log('\n🔐 You can now login to /admin with these credentials');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Admin setup failed:', error);
    process.exit(1);
  }
};

// Run setup
connectDB().then(() => {
  setupAdmins();
});
