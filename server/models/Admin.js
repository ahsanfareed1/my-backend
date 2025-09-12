const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
    required: false, // Initially empty, set when admin sets password
    minlength: 6
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin'],
    default: 'admin'
  },
  permissions: {
    manageServiceProviders: { type: Boolean, default: true },
    manageListings: { type: Boolean, default: true },
    manageComplaints: { type: Boolean, default: true },
    manageReviews: { type: Boolean, default: true },
    viewAnalytics: { type: Boolean, default: true },
    manageAdmins: { type: Boolean, default: false } // Only super_admin can manage other admins
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'suspended', 'inactive'],
    default: 'pending'
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  isPasswordSet: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null // null for initial super admin
  },
  profilePicture: {
    type: String,
    default: null // Base64 encoded image or URL
  },
  phone: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// indexes for faster queries
// username and email indexes are automatically created by unique: true
adminSchema.index({ role: 1 });
adminSchema.index({ status: 1 });

// virtual for full name
adminSchema.virtual('displayName').get(function() {
  return this.fullName;
});

// hashing password before saving (only if password is provided)
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.isPasswordSet = true;
    this.status = 'active'; // automatically activate account when password is set
    next();
  } catch (error) {
    next(error);
  }
});

// comparing password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// hashing password manually
adminSchema.methods.hashPassword = async function(password) {
  const saltRounds = 12;
  this.password = await bcrypt.hash(password, saltRounds);
  this.isPasswordSet = true;
  this.status = 'active';
  this.passwordResetToken = null;
  this.passwordResetExpires = null;
};

// generating password reset token
adminSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = resetToken;
  this.passwordResetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return resetToken;
};

// checking if password reset token is valid
adminSchema.methods.isPasswordResetTokenValid = function() {
  return this.passwordResetExpires > Date.now();
};

// creating default super admin
adminSchema.statics.initializeDefaultSuperAdmin = async function() {
  try {
    const existingSuperAdmin = await this.findOne({ role: 'super_admin' });
    
    if (!existingSuperAdmin) {
      const superAdmin = new this({
        username: 'superadmin',
        email: 'admin@aaaservices.com',
        fullName: 'Super Administrator',
        role: 'super_admin',
        permissions: {
          manageServiceProviders: true,
          manageListings: true,
          manageComplaints: true,
          manageReviews: true,
          viewAnalytics: true,
          manageAdmins: true
        },
        status: 'active',
        isPasswordSet: false
      });
      
      await superAdmin.save();
      console.log('Default super admin created. Please set password via email setup.');
    }
  } catch (error) {
    console.error('Error creating default super admin:', error);
  }
};

// making sure virtual fields are serialized
adminSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    return ret;
  }
});

module.exports = mongoose.model('Admin', adminSchema);
