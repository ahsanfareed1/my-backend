const mongoose = require('mongoose');

const serviceCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Category name must not exceed 100 characters']
  },
  slug: {
    type: String,
    required: false, // Changed from true to false since it's auto-generated
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description must not exceed 500 characters']
  },
  icon: {
    type: String,
    default: 'fas fa-cog'
  },
  image: {
    type: String,
    trim: true
  },
  bgColor: {
    type: String,
    default: '#E3F2FD'
  },
  gradient: {
    type: String,
    default: 'linear-gradient(135deg, #E3F2FD 0%, #90CAF9 100%)'
  },
  iconColor: {
    type: String,
    default: '#1976D2'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
    default: null
  },
  subCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  businessCount: {
    type: Number,
    default: 0
  },
  serviceCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved' // Changed from 'pending' to 'approved'
  },
  approvalNote: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// generating slug before saving
serviceCategorySchema.pre('save', function(next) {
  // always generate slug if it doesn't exist or if name is modified
  if (!this.slug || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// virtual for full category path
serviceCategorySchema.virtual('fullPath').get(function() {
  if (this.parentCategory) {
    return `${this.parentCategory.name} > ${this.name}`;
  }
  return this.name;
});

// virtual for category URL
serviceCategorySchema.virtual('categoryUrl').get(function() {
  return `/services?category=${this.slug}`;
});

// indexes for better performance
serviceCategorySchema.index({ name: 'text', description: 'text', tags: 'text' });
// slug index is automatically created by unique: true
serviceCategorySchema.index({ isActive: 1, isFeatured: 1 });
serviceCategorySchema.index({ parentCategory: 1 });
serviceCategorySchema.index({ sortOrder: 1 });
serviceCategorySchema.index({ approvalStatus: 1 });

// finding active categories
serviceCategorySchema.statics.findActive = function() {
  return this.find({ isActive: true, approvalStatus: 'approved' })
    .sort({ sortOrder: 1, name: 1 });
};

// finding featured categories
serviceCategorySchema.statics.findFeatured = function() {
  return this.find({ 
    isActive: true, 
    isFeatured: true, 
    approvalStatus: 'approved' 
  }).sort({ sortOrder: 1, name: 1 });
};

// searching categories
serviceCategorySchema.statics.search = function(searchTerm, filters = {}) {
  const query = {
    isActive: true,
    approvalStatus: 'approved',
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  };

  if (filters.parentCategory) query.parentCategory = filters.parentCategory;
  if (filters.isFeatured !== undefined) query.isFeatured = filters.isFeatured;

  return this.find(query).sort({ sortOrder: 1, name: 1 });
};

// getting category tree
serviceCategorySchema.statics.getCategoryTree = function() {
  return this.aggregate([
    { $match: { isActive: true, approvalStatus: 'approved' } },
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $lookup: {
        from: 'servicecategories',
        localField: '_id',
        foreignField: 'parentCategory',
        as: 'subCategories'
      }
    },
    {
      $match: { parentCategory: null }
    }
  ]);
};

// updating business count
serviceCategorySchema.methods.updateBusinessCount = async function() {
  const Business = require('./Business');
  const count = await Business.countDocuments({ 
    businessType: this.slug,
    status: 'active'
  });
  this.businessCount = count;
  return this.save();
};

// getting category statistics
serviceCategorySchema.methods.getStats = function() {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    businessCount: this.businessCount,
    serviceCount: this.serviceCount,
    isFeatured: this.isFeatured
  };
};

module.exports = mongoose.model('ServiceCategory', serviceCategorySchema);
