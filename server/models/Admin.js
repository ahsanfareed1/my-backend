const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    default: 'admin'
  },
  permissions: {
    manageServiceProviders: { type: Boolean, default: true },
    manageListings: { type: Boolean, default: true },
    manageComplaints: { type: Boolean, default: true },
    manageReviews: { type: Boolean, default: true },
    viewAnalytics: { type: Boolean, default: true }
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to initialize default admins
adminSchema.statics.initializeDefaultAdmins = async function() {
  const defaultAdmins = [
    {
      username: 'ahsanfareed',
      password: 'Group@08',
      email: 'ahsanfareed@admin.com',
      fullName: 'Ahsan Fareed',
      role: 'super_admin'
    },
    {
      username: 'alikhan',
      password: 'Group@08',
      email: 'alikhan@admin.com',
      fullName: 'Ali Khan',
      role: 'admin'
    },
    {
      username: 'alihaider',
      password: 'Group@08',
      email: 'alihaider@admin.com',
      fullName: 'Ali Haider',
      role: 'admin'
    }
  ];

  for (const adminData of defaultAdmins) {
    const existingAdmin = await this.findOne({ username: adminData.username });
    if (!existingAdmin) {
      const admin = new this(adminData);
      await admin.save();
      console.log(`Created admin: ${adminData.username}`);
    }
  }
};

module.exports = mongoose.model('Admin', adminSchema);
