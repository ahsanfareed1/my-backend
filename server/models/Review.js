const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewer is required']
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: [true, 'Business is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating must not exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Review title must not exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    minlength: [10, 'Review comment must be at least 10 characters long'],
    maxlength: [1000, 'Review comment must not exceed 1000 characters']
  },
  serviceType: {
    type: String,
    required: [true, 'Service type is required'],
    enum: [
      'plumbing', 'electrical', 'cleaning', 'painting', 'gardening',
      'repair', 'transport', 'security', 'education', 'food',
      'beauty', 'health', 'construction', 'maintenance', 'other'
    ]
  },
  serviceDate: {
    type: Date,
    default: Date.now
  },
  serviceCost: {
    type: Number,
    min: 0
  },
  serviceQuality: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Service quality rating is required']
  },
  communication: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Communication rating is required']
  },
  valueForMoney: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Value for money rating is required']
  },
  punctuality: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Punctuality rating is required']
  },
  professionalism: {
    type: Number,
    min: 1,
    max: 5,
    required: [true, 'Professionalism rating is required']
  },
  images: [{
    url: String,
    caption: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isHelpful: {
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    helpfulUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  status: {
    type: String,
    enum: ['active', 'hidden', 'flagged', 'deleted'],
    default: 'active'
  },
  adminNotes: {
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
  flags: [{
    reason: {
      type: String,
      enum: ['inappropriate', 'spam', 'fake', 'other']
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reportedAt: { type: Date, default: Date.now },
    description: String
  }],
  response: {
    businessOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: String,
    respondedAt: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// virtual for overall rating
reviewSchema.virtual('overallRating').get(function() {
  const ratings = [
    this.serviceQuality,
    this.communication,
    this.valueForMoney,
    this.punctuality,
    this.professionalism
  ];
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
});

// virtual for review age
reviewSchema.virtual('reviewAge').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
});

// indexes for faster queries
reviewSchema.index({ business: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
reviewSchema.index({ rating: -1, createdAt: -1 });
reviewSchema.index({ serviceType: 1, rating: -1 });
reviewSchema.index({ status: 1, isVerified: 1 });
reviewSchema.index({ 'isHelpful.helpful': -1 });

// updating business rating before saving
reviewSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('rating')) {
    try {
      console.log('🔍 Backend: Review pre-save - Updating business rating for business ID:', this.business);
      console.log('🔍 Backend: Review pre-save - Review rating:', this.rating);
      
      const Business = mongoose.model('Business');
      const business = await Business.findById(this.business);
      
      if (business && business.rating) {
        console.log('🔍 Backend: Review pre-save - Found business, current rating:', business.rating);
        
        // making sure rating structure exists
        if (!business.rating.ratingBreakdown) {
          business.rating.ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        }
        
        if (!business.rating.totalReviews) {
          business.rating.totalReviews = 0;
        }
        
        if (!business.rating.average) {
          business.rating.average = 0;
        }
        
        // making sure the specific rating exists
        const ratingKey = this.rating.toString();
        if (!business.rating.ratingBreakdown[ratingKey]) {
          business.rating.ratingBreakdown[ratingKey] = 0;
        }
        
        // updating rating breakdown
        business.rating.ratingBreakdown[ratingKey]++;
        business.rating.totalReviews++;
        
        // calculating new average
        const total = Object.values(business.rating.ratingBreakdown).reduce((sum, count) => sum + (count || 0), 0);
        business.rating.average = total > 0 ? 
          Object.entries(business.rating.ratingBreakdown)
            .reduce((sum, [rating, count]) => sum + (parseInt(rating) * (count || 0)), 0) / total : 0;
        
        console.log('🔍 Backend: Review pre-save - Updated business rating - Average:', business.rating.average, 'Total:', business.rating.totalReviews);
        console.log('🔍 Backend: Review pre-save - Rating breakdown:', business.rating.ratingBreakdown);
        
        await business.save();
        console.log('🔍 Backend: Review pre-save - Business saved successfully');
      } else {
        console.log('🔍 Backend: Review pre-save - Business or rating structure not found for business ID:', this.business);
      }
    } catch (error) {
      console.error('🔍 Backend: Error updating business rating:', error);
      console.error('🔍 Backend: Error stack:', error.stack);
      // not failing the review save if rating update fails
    }
  }
  next();
});

// marking review as helpful
reviewSchema.methods.markHelpful = function(userId) {
  if (!this.isHelpful.helpfulUsers.includes(userId)) {
    this.isHelpful.helpful++;
    this.isHelpful.helpfulUsers.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

// marking review as not helpful
reviewSchema.methods.markNotHelpful = function(userId) {
  if (this.isHelpful.helpfulUsers.includes(userId)) {
    this.isHelpful.helpful--;
    this.isHelpful.notHelpful++;
    this.isHelpful.helpfulUsers = this.isHelpful.helpfulUsers.filter(id => id.toString() !== userId.toString());
    return this.save();
  }
  return Promise.resolve(this);
};

// flagging review
reviewSchema.methods.flagReview = function(userId, reason, description = '') {
  const flag = {
    reason,
    reportedBy: userId,
    description
  };
  
  this.flags.push(flag);
  
  // auto-hiding review if it gets multiple flags
  if (this.flags.length >= 3) {
    this.status = 'hidden';
  }
  
  return this.save();
};

// getting review summary (for listings)
reviewSchema.methods.getSummary = function() {
  const reviewObject = this.toObject();
  delete reviewObject.comment;
  delete reviewObject.images;
  delete reviewObject.flags;
  delete reviewObject.response;
  return reviewObject;
};

// finding reviews by business
reviewSchema.statics.findByBusiness = function(businessId, options = {}) {
  const query = { business: businessId, status: 'active' };
  
  if (options.rating) query.rating = options.rating;
  if (options.serviceType) query.serviceType = options.serviceType;
  
  return this.find(query)
    .populate('reviewer', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .limit(options.limit || 10);
};

// finding reviews by user
reviewSchema.statics.findByUser = function(userId) {
  return this.find({ reviewer: userId, status: 'active' })
    .populate('business', 'businessName businessType images.logo')
    .sort({ createdAt: -1 });
};

// finding top reviews
reviewSchema.statics.findTopReviews = function(limit = 10) {
  return this.find({ 
    status: 'active', 
    rating: { $gte: 4 },
    isVerified: true 
  })
    .populate('business', 'businessName businessType images.logo')
    .populate('reviewer', 'firstName lastName profilePicture')
    .sort({ 'isHelpful.helpful': -1, createdAt: -1 })
    .limit(limit);
};

// searching reviews
reviewSchema.statics.search = function(searchTerm, filters = {}) {
  const query = {
    status: 'active',
    $or: [
      { title: { $regex: searchTerm, $options: 'i' } },
      { comment: { $regex: searchTerm, $options: 'i' } }
    ]
  };

  if (filters.rating) query.rating = filters.rating;
  if (filters.serviceType) query.serviceType = filters.serviceType;
  if (filters.business) query.business = filters.business;
  if (filters.reviewer) query.reviewer = filters.reviewer;

  return this.find(query)
    .populate('business', 'businessName businessType images.logo')
    .populate('reviewer', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Review', reviewSchema);
