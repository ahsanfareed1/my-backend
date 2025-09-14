const express = require('express');
const router = express.Router();
const Business = require('../models/Business');
const User = require('../models/user');
// const redisCache = require('../config/redis'); // Temporarily disabled

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        error: 'Please provide a valid authentication token in the Authorization header'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if it's an admin token
    if (decoded.adminId) {
      
      const Admin = require('../models/Admin');
      const admin = await Admin.findById(decoded.adminId).select('-password');
      
      if (!admin) {
        return res.status(401).json({ 
          message: 'Invalid admin token',
          error: 'Admin not found for the provided token'
        });
      }

      if (admin.status !== 'active') {
        return res.status(401).json({ 
          message: 'Admin account deactivated',
          error: 'Your admin account has been deactivated. Please contact support.'
        });
      }

      req.user = admin;
      req.user.userType = 'admin';
    } else if (decoded.userId) {
      
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid token',
          error: 'User not found for the provided token'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({ 
          message: 'Account deactivated',
          error: 'Your account has been deactivated. Please contact support.'
        });
      }

      req.user = user;
    } else {
      return res.status(401).json({ 
        message: 'Invalid token structure',
        error: 'Token does not contain valid user or admin information'
      });
    }
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        message: 'Invalid token',
        error: 'The provided token is not valid'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        message: 'Token expired',
        error: 'Your session has expired. Please login again.'
      });
    }
    return res.status(403).json({ 
      message: 'Token verification failed',
      error: 'Unable to verify your authentication token'
    });
  }
};

// Input validation middleware
const validateBusinessInput = (req, res, next) => {
  const { businessName, businessType, description, contact, location } = req.body;
  
  const errors = [];
  
  if (!businessName || businessName.trim().length < 2) {
    errors.push('Business name must be at least 2 characters long');
  }
  
  if (!businessType) {
    errors.push('Business type is required');
  }
  
  if (!description || description.trim().length < 20) {
    errors.push('Description must be at least 20 characters long');
  }
  
  if (!contact || !contact.phone || !contact.email) {
    errors.push('Phone and email are required in contact information');
  }
  
  if (!location || !location.address || !location.city) {
    errors.push('Address and city are required in location information');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};

// POST /api/business - Add new business
router.post('/', authenticateToken, validateBusinessInput, async (req, res) => {
  try {
    const {
      businessName,
      businessType,
      description,
      contact,
      location,
      services,
      additionalServices,
      businessHours,
      images,
      tags
    } = req.body;

    // Check if user already has a business
    const existingBusiness = await Business.findOne({ owner: req.user._id });
    if (existingBusiness) {
      return res.status(400).json({
        message: 'You already have a registered business',
        error: 'Each user can only register one business. Please update your existing business instead.',
        existingBusinessId: existingBusiness._id
      });
    }

    // Validate business type
    const validBusinessTypes = [
      'plumbing', 'electrical', 'cleaning', 'painting', 'gardening',
      'repair', 'transport', 'security', 'education', 'food',
      'beauty', 'health', 'construction', 'maintenance', 'other'
    ];
    
    if (!validBusinessTypes.includes(businessType)) {
      return res.status(400).json({
        message: 'Invalid business type',
        error: `Business type must be one of: ${validBusinessTypes.join(', ')}`
      });
    }

    // Create new business
    const business = new Business({
      owner: req.user._id,
      businessName: businessName.trim(),
      businessType,
      description: description.trim(),
      contact: {
        phone: contact.phone.trim(),
        email: contact.email.trim().toLowerCase(),
        website: contact.website ? contact.website.trim() : undefined
      },
      location: {
        address: location.address.trim(),
        city: location.city.trim(),
        area: location.area ? location.area.trim() : undefined,
        coordinates: location.coordinates || { lat: 0, lng: 0 },
        serviceAreas: location.serviceAreas || []
      },
      services: services || [],
      additionalServices: additionalServices || [],
      businessHours: businessHours || {},
      images: images || {},
      tags: tags ? tags.map(tag => tag.trim()) : [],
      status: 'active' // New businesses start as active but unverified
    });

    await business.save();

    // Update user type to business
    await User.findByIdAndUpdate(req.user._id, { 
      userType: 'business',
      phone: contact.phone // Update user phone if not set
    });

    // Populate owner details for response
    await business.populate('owner', 'firstName lastName email profilePicture');

    res.status(201).json({
      message: 'Business registered successfully! Your business is now active and visible to customers. Upload verification documents to get the verified badge.',
      business,
      nextSteps: [
        'Complete your business profile with detailed information',
        'Upload business images and documents for verification',
        'Set your business hours and service areas',
        'Get verified badge after admin reviews your documents'
      ]
    });

  } catch (error) {
    console.error('Business registration error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Server error during business registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// Helper: ensure current user is business owner or admin
const requireOwnerOrAdmin = async (req, res, next) => {
  try {
    const businessId = req.params.id || req.body.businessId || req.query.businessId;
    if (!businessId) return res.status(400).json({ message: 'Business id is required' });
    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: 'Business not found' });
    const isOwner = String(business.owner) === String(req.user._id);
    const isAdmin = req.user.userType === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized for this business' });
    }
    req.business = business;
    next();
  } catch (e) {
    return res.status(500).json({ message: 'Authorization check failed' });
  }
};

// POST /api/business/:id/verification-docs — owner uploads verification docs (base64 URLs)
router.post('/:id/verification-docs', authenticateToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { license, governmentId, supporting = [] } = req.body;
    const business = req.business;
    if (!license && !governmentId && (!supporting || supporting.length === 0)) {
      return res.status(400).json({ message: 'At least one document is required' });
    }

    if (!business.verification) business.verification = { isVerified: false, documents: [] };
    const docs = [];
    if (license) docs.push(license);
    if (governmentId) docs.push(governmentId);
    if (Array.isArray(supporting)) docs.push(...supporting.filter(Boolean));
    const mapped = docs.map(d => ({ type: String, uploadedAt: new Date(), toString: () => d }))
      .map(d => (typeof d === 'string' ? d : String(d)));

    business.verification.documents = [...(business.verification.documents || []), ...mapped];
    // Keep business active, don't change status to pending
    await business.save();

    return res.json({
      message: 'Documents uploaded successfully. Your business remains active while admin reviews your documents.',
      business: await Business.findById(business._id).select('-__v')
    });
  } catch (error) {
    console.error('Upload verification docs error:', error);
    return res.status(500).json({ message: 'Failed to upload documents' });
  }
});

// Alternate route signature to avoid client/server path mismatches
router.post('/verification-docs/:id', authenticateToken, requireOwnerOrAdmin, async (req, res) => {
  // Delegate to the same logic by setting req.params.id and calling the previous handler is complex here;
  // Instead, simply reuse the code inline
  try {
    const { license, governmentId, supporting = [] } = req.body;
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'Business not found' });
    const isOwner = String(business.owner) === String(req.user._id) || req.user.userType === 'admin';
    if (!isOwner) return res.status(403).json({ message: 'Not authorized for this business' });

    if (!license && !governmentId && (!supporting || supporting.length === 0)) {
      return res.status(400).json({ message: 'At least one document is required' });
    }
    if (!business.verification) business.verification = { isVerified: false, documents: [] };
    const docs = [];
    if (license) docs.push(license);
    if (governmentId) docs.push(governmentId);
    if (Array.isArray(supporting)) docs.push(...supporting.filter(Boolean));
    business.verification.documents = [...(business.verification.documents || []), ...docs];
    // Keep business active, don't change status to pending
    await business.save();
    return res.json({ message: 'Documents uploaded successfully. Your business remains active while admin reviews your documents.', business });
  } catch (e) {
    console.error('Alt upload verification docs error:', e);
    res.status(500).json({ message: 'Failed to upload documents' });
  }
});

// POST /api/business/verification-docs — accepts businessId in body (safe fallback)
router.post('/verification-docs', authenticateToken, async (req, res) => {
  
  try {
    const { businessId, license, governmentId, supporting = [] } = req.body || {};
    
    
    if (!businessId) return res.status(400).json({ message: 'businessId is required' });
    const business = await Business.findById(businessId);
    if (!business) return res.status(404).json({ message: 'Business not found' });
    
    
    
    const isOwner = String(business.owner) === String(req.user._id) || req.user.userType === 'admin';
    if (!isOwner) return res.status(403).json({ message: 'Not authorized for this business' });
    
    if (!license && !governmentId && (!supporting || supporting.length === 0)) {
      return res.status(400).json({ message: 'At least one document is required' });
    }
    
    if (!business.verification) business.verification = { isVerified: false, documents: [] };
    const docs = [];
    if (license) docs.push(license);
    if (governmentId) docs.push(governmentId);
    if (Array.isArray(supporting)) docs.push(...supporting.filter(Boolean));
    
    
    
    business.verification.documents = [...(business.verification.documents || []), ...docs];
    
    
    
    // Keep business active, don't change status to pending
    await business.save();
    
    
    res.json({ message: 'Documents uploaded successfully. Your business remains active while admin reviews your documents.', business });
  } catch (e) {
    console.error('Body-based upload verification docs error:', e);
    res.status(500).json({ message: 'Failed to upload documents' });
  }
});

// Additional aliases for robustness
router.post('/verify-docs', authenticateToken, async (req, res) => {
  req.url = '/verification-docs';
  return router.handle(req, res, () => {});
});
router.post('/upload-docs', authenticateToken, async (req, res) => {
  req.url = '/verification-docs';
  return router.handle(req, res, () => {});
});
// GET /api/business/verification/pending — admin list
router.get('/verification/pending', authenticateToken, async (req, res) => {
  try {
    
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // First, let's see all businesses and their verification status
    const allBusinesses = await Business.find({}).select('businessName verification status');
    
    // Find businesses that are not verified yet (regardless of status)
    const items = await Business.find({ 
      $or: [
        { 'verification.isVerified': { $ne: true } },
        { 'verification.isVerified': { $exists: false } }
      ]
    })
      .select('businessName businessType owner verification status createdAt location contact')
      .populate('owner', 'firstName lastName email');
    
    
    
    // Filter out businesses that already have documents uploaded
    const businessesWithDocs = items.filter(b => b.verification?.documents && b.verification.documents.length > 0);
    const businessesWithoutDocs = items.filter(b => !b.verification?.documents || b.verification.documents.length === 0);
    
    
    
    res.json({ 
      pending: businessesWithDocs,
      withoutDocs: businessesWithoutDocs,
      total: items.length,
      withDocuments: businessesWithDocs.length,
      withoutDocuments: businessesWithoutDocs.length
    });
  } catch (e) {
    console.error('Error fetching pending verifications:', e);
    res.status(500).json({ message: 'Failed to load pending verifications' });
  }
});

// POST /api/business/:id/verification/decision — admin approve/reject
router.post('/:id/verification/decision', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ message: 'Business not found' });
    const { decision, note } = req.body; // decision: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approve or reject' });
    }
    if (decision === 'approve') {
      business.verification.isVerified = true;
      business.verification.verifiedAt = new Date();
      business.verification.verifiedBy = req.user._id;
      business.status = 'active';
      business.statusReason = undefined;
    } else {
      business.verification.isVerified = false;
      business.status = 'rejected';
      business.statusReason = note || 'Verification rejected. Please resubmit documents.';
    }
    business.statusUpdatedAt = new Date();
    business.statusUpdatedBy = req.user._id;
    await business.save();
    res.json({ message: `Verification ${decision}d`, business });
  } catch (e) {
    console.error('Decision error', e);
    res.status(500).json({ message: 'Failed to update verification decision' });
  }
});
// GET /api/business - Fetch all businesses (optimized with caching)
router.get('/', async (req, res) => {
  try {
    
    const {
      page = 1,
      limit = 10,
      businessType,
      city,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isVerified,
      minRating,
      status = 'active'
    } = req.query;

    // Create cache key for this search
    const cacheKey = {
      page: parseInt(page),
      limit: parseInt(limit),
      businessType,
      city,
      search,
      sortBy,
      sortOrder,
      isVerified,
      minRating,
      status
    };
    
    
    const skip = (page - 1) * limit;
    let query = { status };

    // Apply filters
    if (businessType) query.businessType = businessType;
    if (city) {
      // Enhanced location search across multiple fields like Yelp
      query.$or = [
        { 'location.city': { $regex: city, $options: 'i' } },
        { 'location.area': { $regex: city, $options: 'i' } },
        { 'location.address': { $regex: city, $options: 'i' } },
        { 'location.serviceAreas': { $in: [new RegExp(city, 'i')] } }
      ];
    }
    if (isVerified !== undefined) query['verification.isVerified'] = isVerified === 'true';
    if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };

    // Apply search - use text search if available, fallback to regex
    if (search && search.trim()) {
      const searchTerm = search.trim();
      
      // Try text search first (faster with indexes)
      try {
        const textSearchQuery = { 
          status,
          $text: { $search: searchTerm }
        };
        
        // Apply additional filters to text search
        if (businessType) textSearchQuery.businessType = businessType;
        if (city) {
          // Enhanced location search for text search as well
          textSearchQuery.$or = [
            { 'location.city': { $regex: city, $options: 'i' } },
            { 'location.area': { $regex: city, $options: 'i' } },
            { 'location.address': { $regex: city, $options: 'i' } },
            { 'location.serviceAreas': { $in: [new RegExp(city, 'i')] } }
          ];
        }
        if (isVerified !== undefined) textSearchQuery['verification.isVerified'] = isVerified === 'true';
        if (minRating) textSearchQuery['rating.average'] = { $gte: parseFloat(minRating) };

        // Execute text search
        const textResults = await Business.find(textSearchQuery)
          .populate('owner', 'firstName lastName email profilePicture')
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(parseInt(limit))
          .select('-verification.documents -__v');

        const textTotal = await Business.countDocuments(textSearchQuery);

        const response = {
          businesses: textResults,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(textTotal / limit),
            totalBusinesses: textTotal,
            hasNextPage: page * limit < textTotal,
            hasPrevPage: page > 1,
            limit: parseInt(limit)
          },
          filters: { businessType, city, search, isVerified, minRating, status },
          searchMethod: 'text'
        };

        // Cache the result
        // await redisCache.cacheBusinessSearch(cacheKey, response); // Cache temporarily disabled
        
        
        return res.json(response);
        
      } catch (textError) {
        
        // Fallback to regex search
        query.$or = [
          { businessName: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { tags: { $in: [new RegExp(searchTerm, 'i')] } },
          { 'location.city': { $regex: searchTerm, $options: 'i' } },
          { 'location.area': { $regex: searchTerm, $options: 'i' } },
          { 'location.address': { $regex: searchTerm, $options: 'i' } }
        ];
      }
    }

    // Build sort object - optimize for common sort patterns
    let sort = {};
    if (sortBy === 'rating') {
      sort = { 'rating.average': -1, 'rating.totalReviews': -1, createdAt: -1 };
    } else if (sortBy === 'name') {
      sort = { businessName: 1 };
    } else if (sortBy === 'newest') {
      sort = { createdAt: -1 };
    } else if (sortBy === 'oldest') {
      sort = { createdAt: 1 };
    } else {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    

    // Execute query with lean() for better performance
    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-verification.documents -__v')
      .lean(); // Use lean() for better performance when you don't need Mongoose documents

    

    // Get total count for pagination
    const total = await Business.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page * limit < total;
    const hasPrevPage = page > 1;

    const response = {
      businesses,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalBusinesses: total,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      },
      filters: { businessType, city, search, isVerified, minRating, status },
      searchMethod: 'regex'
    };

    // Cache the result
    // await redisCache.cacheBusinessSearch(cacheKey, response); // Cache temporarily disabled
    
    
    res.json(response);

  } catch (error) {
    console.error('Get businesses error:', error);
    res.status(500).json({
      message: 'Server error while fetching businesses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/:id - Fetch single business details
router.get('/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate('owner', 'firstName lastName email profilePicture phone')
      .populate('verification.verifiedBy', 'firstName lastName');

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    // If not active, allow owner to view when authenticated
    if (business.status !== 'active') {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          if (decoded?.userId && String(business.owner?._id) === String(decoded.userId)) {
            return res.json({ business, note: `Owner view: business is ${business.status}` });
          }
        }
      } catch (e) {
        // ignore token errors and fall through to 404
      }
      return res.status(404).json({
        message: 'Business not available',
        error: `This business is currently ${business.status}`
      });
    }

    res.json({ business });

  } catch (error) {
    console.error('Get business by ID error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid business ID',
        error: 'The provided business ID is not in the correct format'
      });
    }
    res.status(500).json({
      message: 'Server error while fetching business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// PUT /api/business/:id - Update business
router.put('/:id', authenticateToken, validateBusinessInput, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    // Check if user owns this business
    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied',
        error: 'You can only update your own business'
      });
    }

    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.owner;
    delete updateData.verification;
    delete updateData.rating;

    // Allow owners to activate their business (but not set arbitrary statuses)
    if (updateData.status && updateData.status !== 'active') {
      delete updateData.status;
    }
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Clean and validate update data
    if (updateData.businessName) updateData.businessName = updateData.businessName.trim();
    if (updateData.description) updateData.description = updateData.description.trim();
    if (updateData.contact) {
      if (updateData.contact.phone) updateData.contact.phone = updateData.contact.phone.trim();
      if (updateData.contact.email) updateData.contact.email = updateData.contact.email.toLowerCase().trim();
      if (updateData.contact.website) updateData.contact.website = updateData.contact.website.trim();
    }
    if (updateData.location) {
      if (updateData.location.address) updateData.location.address = updateData.location.address.trim();
      if (updateData.location.city) updateData.location.city = updateData.location.city.trim();
      if (updateData.location.area) updateData.location.area = updateData.location.area.trim();
    }
    if (updateData.tags) {
      updateData.tags = updateData.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    const updatedBusiness = await Business.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'firstName lastName email profilePicture');

    // Cache invalidation temporarily disabled for stability
    // await redisCache.invalidateBusinessCache(req.params.id);

    res.json({
      message: 'Business updated successfully',
      business: updatedBusiness
    });

  } catch (error) {
    console.error('Update business error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Server error while updating business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// DELETE /api/business/:id - Delete business
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    // Check if user owns this business
    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied',
        error: 'You can only delete your own business'
      });
    }

    // Soft delete - mark as inactive
    business.status = 'inactive';
    await business.save();

    // Update user type back to customer
    await User.findByIdAndUpdate(req.user._id, { userType: 'customer' });

    res.json({
      message: 'Business deleted successfully',
      note: 'Your business has been deactivated. You can reactivate it anytime by updating the status.'
    });

  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({
      message: 'Server error while deleting business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/owner/my-business - Get user's own business
router.get('/owner/my-business', authenticateToken, async (req, res) => {
  try {
    const business = await Business.findOne({ owner: req.user._id })
      .populate('owner', 'firstName lastName email profilePicture');

    if (!business) {
      return res.status(404).json({
        message: 'No business found for this user',
        error: 'You have not registered a business yet',
        nextSteps: [
          'Register your business using POST /api/business',
          'Provide business details, contact information, and location',
          'Upload business images and set service areas'
        ]
      });
    }

    res.json({
      business
    });

  } catch (error) {
    console.error('Get my business error:', error);
    res.status(500).json({
      message: 'Server error while fetching business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/slug/:category/:slug - Get business by category and slug
router.get('/slug/:category/:slug', async (req, res) => {
  try {
    const { category, slug } = req.params;
    
    // Map category slug to business type
    const categoryToBusinessType = {
      'plumbing-services': 'plumbing',
      'electrical-services': 'electrical',
      'cleaning-services': 'cleaning',
      'painting-services': 'painting',
      'gardening-landscaping': 'gardening',
      'repair-maintenance': 'repair',
      'transport-services': 'transport',
      'security-services': 'security',
      'education-training': 'education',
      'food-catering': 'food',
      'beauty-personal-care': 'beauty',
      'health-medical': 'health',
      'construction-services': 'construction',
      'maintenance-services': 'maintenance',
      'automotive-services': 'automotive',
      'pet-services': 'other',
      'pest-control': 'other',
      'it-technology': 'other',
      'business-services': 'other',
      'other-services': 'other'
    };

    const businessType = categoryToBusinessType[category] || category;

    // Find businesses by business type and generate slug from business name
    const businesses = await Business.find({ 
      businessType: businessType,
      status: 'active'
    })
      .populate('owner', 'firstName lastName email profilePicture')
      .select('-verification.documents -__v');

    // Find business by matching slug
    const business = businesses.find(biz => {
      if (!biz.businessName) return false;
      
      const bizSlug = biz.businessName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
      
      return bizSlug === slug;
    });

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist or is not active'
      });
    }

    res.json({ business });

  } catch (error) {
    console.error('Get business by slug error:', error);
    res.status(500).json({
      message: 'Server error while fetching business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/type/:businessType - Get businesses by type
router.get('/type/:businessType', async (req, res) => {
  try {
    const { businessType } = req.params;
    const { page = 1, limit = 10, city, status = 'active' } = req.query;
    const skip = (page - 1) * limit;

    let query = { businessType, status };
    if (city) query['location.city'] = { $regex: city, $options: 'i' };

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-verification.documents -__v');

    const total = await Business.countDocuments(query);

    res.json({
      businesses,
      businessType,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBusinesses: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get businesses by type error:', error);
    res.status(500).json({
      message: 'Server error while fetching businesses by type',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/location/:city - Get businesses by location
router.get('/location/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { page = 1, limit = 10, businessType, status = 'active' } = req.query;
    const skip = (page - 1) * limit;

    let query = { 'location.city': { $regex: city, $options: 'i' }, status };
    if (businessType) query.businessType = businessType;

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-verification.documents -__v');

    const total = await Business.countDocuments(query);

    res.json({
      businesses,
      city,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBusinesses: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get businesses by location error:', error);
    res.status(500).json({
      message: 'Server error while fetching businesses by location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/featured/verified - Get verified businesses
router.get('/featured/verified', async (req, res) => {
  try {
    const { limit = 10, city } = req.query;

    let query = {
      'verification.isVerified': true,
      status: 'active'
    };
    
    if (city) query['location.city'] = { $regex: city, $options: 'i' };

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort({ 'rating.average': -1, 'rating.totalReviews': -1 })
      .limit(parseInt(limit))
      .select('-verification.documents -__v');

    res.json({
      businesses,
      total: businesses.length,
      note: 'These are verified businesses with high ratings'
    });

  } catch (error) {
    console.error('Get verified businesses error:', error);
    res.status(500).json({
      message: 'Server error while fetching verified businesses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// PATCH /api/business/:id/status - Update business status (for admin use)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        message: 'Access denied',
        error: 'Only administrators can update business status'
      });
    }

    const { status, verificationNote } = req.body;
    const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    business.status = status;
    
    // Only set verification to true if explicitly approved by admin
    // Don't automatically verify when setting status to active
    
    await business.save();

    res.json({
      message: `Business status updated to ${status}`,
      business: {
        id: business._id,
        businessName: business.businessName,
        status: business.status,
        verification: business.verification
      }
    });

  } catch (error) {
    console.error('Update business status error:', error);
    res.status(500).json({
      message: 'Server error while updating business status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// Temporary endpoint to reset all businesses to unverified (for testing)
router.post('/reset-verification', authenticateToken, async (req, res) => {
  try {
    if (req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const result = await Business.updateMany(
      {},
      { 
        'verification.isVerified': false,
        'verification.verifiedAt': null,
        'verification.verifiedBy': null
      }
    );
    
    res.json({ 
      message: `Reset verification for ${result.modifiedCount} businesses`,
      modifiedCount: result.modifiedCount
    });
  } catch (e) {
    console.error('Error resetting verification:', e);
    res.status(500).json({ message: 'Failed to reset verification' });
  }
});

router.get('/debug/all', async (req, res) => {
  try {
    const businesses = await Business.find({})
      .select('businessName verification status owner')
      .populate('owner', 'firstName lastName email');
    res.json({ 
      businesses: businesses.map(b => ({
        name: b.businessName,
        verified: b.verification?.isVerified,
        hasDocs: b.verification?.documents?.length > 0,
        status: b.status,
        owner: b.owner?.firstName + ' ' + b.owner?.lastName
      })),
      total: businesses.length
    });
  } catch (e) {
    console.error('Debug endpoint error:', e);
    res.status(500).json({ message: 'Debug endpoint error' });
  }
});

module.exports = router;
