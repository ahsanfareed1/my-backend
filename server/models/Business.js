const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Business owner is required']
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: [100, 'Business name must not exceed 100 characters']
  },
  businessType: {
    type: String,
    required: [true, 'Business type is required'],
    enum: [
      'plumbing', 'electrical', 'cleaning', 'painting', 'gardening',
      'repair', 'transport', 'security', 'education', 'food',
      'beauty', 'health', 'construction', 'roofing', 'maintenance', 
      'legal', 'accounting', 'automotive', 'technology', 'business', 
      'pet', 'pest', 'marketing', 'medical', 'dental', 'fitness',
      'tutoring', 'language', 'event', 'photography', 'entertainment',
      'financial', 'insurance', 'other'
    ]
  },
  description: {
    type: String,
    required: [true, 'Business description is required'],
    trim: true,
    minlength: [20, 'Description must be at least 20 characters long'],
    maxlength: [1000, 'Description must not exceed 1000 characters']
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Please enter a valid website URL']
    }
  },
  location: {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    area: {
      type: String,
      trim: true
    },
    coordinates: {
      lat: {
        type: Number,
        min: -90,
        max: 90
      },
      lng: {
        type: Number,
        min: -180,
        max: 180
      }
    },
    serviceAreas: [{
      type: String,
      trim: true
    }]
  },
  services: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      min: 0
    },
    priceType: {
      type: String,
      enum: ['fixed', 'hourly', 'negotiable'],
      default: 'negotiable'
    },
    currency: {
      type: String,
      default: 'PKR',
      enum: ['PKR']
    }
  }],
  additionalServices: [{
    serviceTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Service title must not exceed 100 characters']
    },
    serviceDescription: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, 'Service description must be at least 10 characters long'],
      maxlength: [500, 'Service description must not exceed 500 characters']
    },
    pricing: {
      type: {
        type: String,
        required: true,
        enum: ['fixed', 'hourly', 'negotiable']
      },
      amount: {
        type: Number,
        min: 0,
        required: function() {
          return this.pricing.type === 'fixed' || this.pricing.type === 'hourly';
        }
      },
      currency: {
        type: String,
        default: 'PKR',
        enum: ['PKR']
      },
      unit: {
        type: String,
        enum: ['per service', 'per hour', 'per day', 'per month'],
        required: function() {
          return this.pricing.type === 'hourly';
        }
      }
    }
  }],
  images: {
    logo: {
      type: String,
      trim: true
    },
    cover: {
      type: [String],
      trim: true,
      validate: {
        validator: function(v) {
          // Validate that cover array has at most 5 images
          if (Array.isArray(v) && v.length > 5) {
            return false;
          }
          return true;
        },
        message: 'Cover photos cannot have more than 5 images'
      }
    }
  },
  businessHours: {
    monday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '17:00' }, 
      closed: { type: Boolean, default: false } 
    },
    tuesday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '17:00' }, 
      closed: { type: Boolean, default: false } 
    },
    wednesday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '17:00' }, 
      closed: { type: Boolean, default: false } 
    },
    thursday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '17:00' }, 
      closed: { type: Boolean, default: false } 
    },
    friday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '17:00' }, 
      closed: { type: Boolean, default: false } 
    },
    saturday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '17:00' }, 
      closed: { type: Boolean, default: false } 
    },
    sunday: { 
      open: { type: String, default: '09:00' }, 
      close: { type: String, default: '17:00' }, 
      closed: { type: Boolean, default: false } 
    }
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    ratingBreakdown: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 }
    }
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    documents: [{
      type: String,
      description: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending', 'rejected'],
    default: 'pending'
  },
  statusReason: {
    type: String,
    trim: true
  },
  statusUpdatedAt: {
    type: Date
  },
  statusUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  features: {
    isPremium: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    acceptsOnlineBooking: { type: Boolean, default: true },
    acceptsEmergencyCalls: { type: Boolean, default: false }
  },
  socialMedia: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String
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

// automatically adding "Service Provider" tag
businessSchema.pre('save', function(next) {
  // making sure tags array exists
  if (!this.tags) {
    this.tags = [];
  }
  
  // adding "Service Provider" tag if not already there
  if (!this.tags.includes('Service Provider')) {
    this.tags.push('Service Provider');
  }
  
  next();
});

// virtual for business URL
businessSchema.virtual('businessUrl').get(function() {
  return `/api/business/${this._id}`;
});

// virtual for full address
businessSchema.virtual('fullAddress').get(function() {
  return `${this.location.address}, ${this.location.area}, ${this.location.city}`;
});

// virtual for average rating display
businessSchema.virtual('ratingDisplay').get(function() {
  if (!this.rating || typeof this.rating.average !== 'number') {
    return '0.0';
  }
  return this.rating.average.toFixed(1);
});

// indexes for faster queries
businessSchema.index({ 'location.city': 1, businessType: 1 });
businessSchema.index({ 'location.coordinates': '2dsphere' });
businessSchema.index({ businessType: 1, status: 1 });
businessSchema.index({ 'rating.average': -1 });
businessSchema.index({ 'verification.isVerified': 1, status: 1 });
businessSchema.index({ owner: 1 });

// updating rating before saving
businessSchema.pre('save', function(next) {
  // making sure rating structure exists
  if (!this.rating) {
    this.rating = {
      average: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }
  
  // making sure rating breakdown exists
  if (!this.rating.ratingBreakdown) {
    this.rating.ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }
  
  // making sure totalReviews exists
  if (typeof this.rating.totalReviews !== 'number') {
    this.rating.totalReviews = 0;
  }
  
  // making sure average exists
  if (typeof this.rating.average !== 'number') {
    this.rating.average = 0;
  }
  
  // making sure images structure exists
  if (!this.images) {
    this.images = {
      logo: undefined,
      cover: undefined,
      gallery: []
    };
  }
  
  // making sure gallery is always an array
  if (!Array.isArray(this.images.gallery)) {
    this.images.gallery = [];
  }
  
  if (this.rating.totalReviews > 0) {
    const total = Object.values(this.rating.ratingBreakdown).reduce((sum, count) => sum + (count || 0), 0);
    this.rating.average = total > 0 ? 
      Object.entries(this.rating.ratingBreakdown)
        .reduce((sum, [rating, count]) => sum + (parseInt(rating) * (count || 0)), 0) / total : 0;
  }
  next();
});

// updating rating when review is added
businessSchema.methods.updateRating = function(newRating) {
  // making sure rating structure exists
  if (!this.rating) {
    this.rating = {
      average: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }
  
  // making sure rating breakdown exists
  if (!this.rating.ratingBreakdown) {
    this.rating.ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }
  
  // making sure the specific rating exists
  const ratingKey = newRating.toString();
  if (!this.rating.ratingBreakdown[ratingKey]) {
    this.rating.ratingBreakdown[ratingKey] = 0;
  }
  
  this.rating.ratingBreakdown[ratingKey]++;
  this.rating.totalReviews++;
  
  // calculating new average
  const total = Object.values(this.rating.ratingBreakdown).reduce((sum, count) => sum + (count || 0), 0);
  this.rating.average = total > 0 ? 
    Object.entries(this.rating.ratingBreakdown)
      .reduce((sum, [rating, count]) => sum + (parseInt(rating) * (count || 0)), 0) / total : 0;
  
  return this.save();
};

// getting business summary (for listings)
businessSchema.methods.getSummary = function() {
  const businessObject = this.toObject();
  delete businessObject.description;
  delete businessObject.businessHours;
  delete businessObject.services;
  delete businessObject.verification;
  delete businessObject.features;
  delete businessObject.socialMedia;
  return businessObject;
};

// finding businesses by location
businessSchema.statics.findByLocation = function(city, businessType = null) {
  const query = { 'location.city': city, status: 'active' };
  if (businessType) query.businessType = businessType;
  return this.find(query).populate('owner', 'firstName lastName email');
};

// finding verified businesses
businessSchema.statics.findVerified = function() {
  return this.find({ 
    'verification.isVerified': true, 
    status: 'active' 
  }).populate('owner', 'firstName lastName email');
};

// finding businesses by type
businessSchema.statics.findByType = function(businessType) {
  return this.find({ 
    businessType, 
    status: 'active' 
  }).populate('owner', 'firstName lastName email');
};

// searching businesses
businessSchema.statics.search = function(searchTerm, filters = {}) {
  const query = {
    status: 'active',
    $or: [
      { businessName: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  };

  if (filters.businessType) query.businessType = filters.businessType;
  if (filters.city) query['location.city'] = filters.city;
  if (filters.isVerified) query['verification.isVerified'] = filters.isVerified;

  return this.find(query).populate('owner', 'firstName lastName email');
};

module.exports = mongoose.model('Business', businessSchema);
