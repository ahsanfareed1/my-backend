const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  // User who filed the complaint
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // User's email address for direct contact
  userEmail: {
    type: String,
    required: [true, 'User email is required'],
    trim: true,
    lowercase: true
  },
  
  // Business/Service Provider being complained about
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  
  // Complaint details
  title: {
    type: String,
    required: [true, 'Complaint title is required'],
    trim: true,
    maxlength: [200, 'Complaint title must not exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Complaint description is required'],
    trim: true,
    maxlength: [2000, 'Complaint description must not exceed 2000 characters']
  },
  
  // Service category
  serviceCategory: {
    type: String,
    required: [true, 'Service category is required'],
    enum: ['plumbing', 'electrical', 'cleaning', 'painting', 'gardening', 'repair', 'transport', 'security', 'education', 'food', 'beauty', 'health', 'construction', 'maintenance', 'other']
  },
  
  // Complaint severity
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'under_review', 'investigating', 'resolved', 'closed', 'rejected'],
    default: 'pending'
  },
  
  // Admin notes and actions
  adminNotes: [{
    note: String,
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Resolution details
  resolution: {
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    actionTaken: String
  },
  
  // Contact information
  contactInfo: {
    phone: String,
    preferredContactMethod: {
      type: String,
      enum: ['email', 'phone', 'both'],
      default: 'email'
    }
  },
  
  // Evidence/Attachments (URLs to uploaded files)
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Priority based on severity and age
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// virtual for complaint age
complaintSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// virtual for isUrgent (complaints older than 7 days with high/critical severity)
complaintSchema.virtual('isUrgent').get(function() {
  return this.ageInDays > 7 && ['high', 'critical'].includes(this.severity);
});

// updating priority before saving
complaintSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // calculating priority based on severity and age
  let priority = 'normal';
  
  if (this.severity === 'critical') {
    priority = 'urgent';
  } else if (this.severity === 'high') {
    priority = this.ageInDays > 3 ? 'urgent' : 'high';
  } else if (this.severity === 'medium') {
    priority = this.ageInDays > 7 ? 'high' : 'normal';
  } else if (this.severity === 'low') {
    priority = this.ageInDays > 14 ? 'normal' : 'low';
  }
  
  this.priority = priority;
  next();
});

// indexes for faster queries
complaintSchema.index({ status: 1, priority: 1 });
complaintSchema.index({ businessId: 1 });
complaintSchema.index({ userId: 1 });
complaintSchema.index({ userEmail: 1 });
complaintSchema.index({ serviceCategory: 1 });
complaintSchema.index({ severity: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ priority: 1, createdAt: -1 });

// getting complaint statistics
complaintSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgAge: { $avg: { $subtract: [new Date(), '$createdAt'] } }
      }
    }
  ]);
  
  return stats;
};

// adding admin note
complaintSchema.methods.addAdminNote = function(note, adminId) {
  this.adminNotes.push({
    note,
    adminId,
    timestamp: new Date()
  });
  return this.save();
};

// updating status
complaintSchema.methods.updateStatus = function(newStatus, adminId, note = '') {
  this.status = newStatus;
  this.updatedAt = new Date();
  
  if (note) {
    this.addAdminNote(note, adminId);
  }
  
  return this.save();
};

module.exports = mongoose.model('Complaint', complaintSchema);
