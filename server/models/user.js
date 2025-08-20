const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: false, // Make it optional
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username must not exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name must not exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name must not exceed 50 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  profilePicture: {
    type: String,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  userType: {
    type: String,
    enum: ['customer', 'business', 'admin'],
    default: 'customer'
  },
  location: {
    city: String,
    area: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  lastLogin: {
    type: Date,
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for profile URL
userSchema.virtual('profileUrl').get(function() {
  return `/api/users/${this._id}`;
});

// Pre-save middleware to hash password and generate username
userSchema.pre('save', async function(next) {
  // Generate username from email if not provided
  if (!this.username) {
    const emailPrefix = this.email.split('@')[0];
    let baseUsername = emailPrefix;
    let counter = 1;
    
    // Check if username exists and generate unique one
    while (await mongoose.model('User').findOne({ username: baseUsername })) {
      baseUsername = `${emailPrefix}${counter}`;
      counter++;
    }
    this.username = baseUsername;
  }
  
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to automatically add tags based on user type
userSchema.pre('save', function(next) {
  // Ensure tags array exists
  if (!this.tags) {
    this.tags = [];
  }
  
  // Add appropriate tag based on user type
  if (this.userType === 'customer' && !this.tags.includes('Customer')) {
    this.tags.push('Customer');
  } else if (this.userType === 'business' && !this.tags.includes('Service Provider')) {
    this.tags.push('Service Provider');
  } else if (this.userType === 'admin' && !this.tags.includes('Admin')) {
    this.tags.push('Admin');
  }
  
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

// Static method to find users by location
userSchema.statics.findByLocation = function(city) {
  return this.find({ 'location.city': city, isActive: true });
};

// Static method to find users by type
userSchema.statics.findByType = function(userType) {
  return this.find({ userType, isActive: true });
};

module.exports = mongoose.model('User', userSchema);
