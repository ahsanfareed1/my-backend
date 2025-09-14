const express = require('express');
const router = express.Router();
const ServiceCategory = require('../models/ServiceCategory');

// active service categories lane k liye
router.get('/', async (req, res) => {
  try {
    const { search, featured, parent, limit = 100 } = req.query;
    
    // cache abhi disabled hai stability k liye

    let query = { isActive: true, approvalStatus: 'approved' };
    
    if (search) {
      query = {
        ...query,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      };
    }
    
    if (featured === 'true') {
      query.isFeatured = true;
    }
    
    if (parent) {
      if (parent === 'null') {
        query.parentCategory = null;
      } else {
        query.parentCategory = parent;
      }
    }

    const categories = await ServiceCategory.find(query)
      .populate('parentCategory', 'name slug')
      .populate('subCategories', 'name slug businessCount')
      .sort({ sortOrder: 1, name: 1 })
      .limit(parseInt(limit))
      .lean();

    const Business = require('../models/Business');
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const businessTypeMap = {
          // Plumbing & Water Services
          'plumbing-services': 'plumbing',
          'plumbing': 'plumbing',
          'water-services': 'plumbing',
          'pipe-services': 'plumbing',
          'drain-services': 'plumbing',
          
          // Electrical Services
          'electrical-services': 'electrical',
          'electrical': 'electrical',
          'wiring-services': 'electrical',
          'power-services': 'electrical',
          'lighting-services': 'electrical',
          
          // Cleaning Services
          'cleaning-services': 'cleaning',
          'cleaning': 'cleaning',
          'home-cleaning': 'cleaning',
          'housekeeping': 'cleaning',
          'janitorial-services': 'cleaning',
          
          // Painting Services
          'painting-services': 'painting',
          'painting': 'painting',
          'home-painting': 'painting',
          'wall-painting': 'painting',
          'coating-services': 'painting',
          
          // Gardening & Landscaping
          'gardening-landscaping': 'gardening',
          'gardening': 'gardening',
          'landscaping': 'gardening',
          'lawn-care': 'gardening',
          'outdoor-services': 'gardening',
          'yard-maintenance': 'gardening',
          
          // Repair & Maintenance
          'repair-maintenance': 'repair',
          'repair': 'repair',
          'home-repair-maintenance': 'repair',
          'appliance-repair': 'repair',
          'fix-services': 'repair',
          'restoration': 'repair',
          
          // Transport Services
          'transport-services': 'transport',
          'transport': 'transport',
          'moving-services': 'transport',
          'delivery-services': 'transport',
          'shipping-services': 'transport',
          'logistics': 'transport',
          
          // Security Services
          'security-services': 'security',
          'security': 'security',
          'guard-services': 'security',
          'safety-services': 'security',
          'protection-services': 'security',
          'lock-services': 'security',
          
          // Education & Training
          'education-training': 'education',
          'education': 'education',
          'tutoring': 'education',
          'training-services': 'education',
          'learning-services': 'education',
          'course-services': 'education',
          'school-services': 'education',
          
          // Food Services
          'food-catering': 'food',
          'food-delivery': 'food',
          'food': 'food',
          'catering': 'food',
          'restaurant-services': 'food',
          'cooking-services': 'food',
          'meal-services': 'food',
          'dining-services': 'food',
          
          // Beauty & Personal Care
          'beauty-personal-care': 'beauty',
          'beauty': 'beauty',
          'salon-services': 'beauty',
          'spa-services': 'beauty',
          'grooming-services': 'beauty',
          'cosmetic-services': 'beauty',
          'hair-services': 'beauty',
          
          // Health & Medical
          'health-medical': 'health',
          'health': 'health',
          'medical': 'health',
          'fitness-services': 'health',
          'wellness-services': 'health',
          'therapy-services': 'health',
          'care-services': 'health',
          
          // Construction Services
          'construction-services': 'construction',
          'construction': 'construction',
          'building-services': 'construction',
          'renovation-services': 'construction',
          'remodeling-services': 'construction',
          'contractor-services': 'construction',
          
          // Roofing Services
          'roofing-services': 'roofing',
          'roofing': 'roofing',
          'roof-repair': 'roofing',
          'roof-installation': 'roofing',
          'roof-maintenance': 'roofing',
          
          // Maintenance Services
          'maintenance-services': 'maintenance',
          'maintenance': 'maintenance',
          'facility-management': 'maintenance',
          'upkeep-services': 'maintenance',
          'service-maintenance': 'maintenance',
          
          // Legal Services
          'legal-services': 'legal',
          'legal': 'legal',
          'law-services': 'legal',
          'attorney-services': 'legal',
          'lawyer-services': 'legal',
          'counsel-services': 'legal',
          
          // Accounting Services
          'accounting-services': 'accounting',
          'accounting': 'accounting',
          'bookkeeping-services': 'accounting',
          'finance-services': 'accounting',
          'tax-services': 'accounting',
          'audit-services': 'accounting',
          
          // Automotive Services
          'automotive-services': 'automotive',
          'automotive': 'automotive',
          'car-services': 'automotive',
          'vehicle-services': 'automotive',
          'auto-services': 'automotive',
          'mechanic-services': 'automotive',
          
          // IT & Technology
          'it-technology': 'technology',
          'it-services': 'technology',
          'technology': 'technology',
          'tech-services': 'technology',
          'computer-services': 'technology',
          'software-services': 'technology',
          'digital-services': 'technology',
          
          // Business Services
          'business-services': 'business',
          'business': 'business',
          'consulting-services': 'business',
          'professional-services': 'business',
          'corporate-services': 'business',
          'management-services': 'business',
          
          // Pet Services
          'pet-services': 'pet',
          'pet': 'pet',
          'animal-services': 'pet',
          'veterinary-services': 'pet',
          'pet-grooming': 'pet',
          'dog-services': 'pet',
          'cat-services': 'pet',
          
          // Pest Control
          'pest-control': 'pest',
          'pest': 'pest',
          'exterminator-services': 'pest',
          'bug-control': 'pest',
          'insect-control': 'pest',
          'rodent-control': 'pest',
          
          // Car Services
          'car-repair-maintenance': 'automotive',
          'car-wash-detailing': 'automotive',
          
          // Marketing Services
          'marketing-services': 'marketing',
          'marketing': 'marketing',
          'digital-marketing': 'marketing',
          'social-media': 'marketing',
          'seo-services': 'marketing',
          'advertising': 'marketing',
          
          // IT Services
          'it-support-services': 'technology',
          'web-development': 'technology',
          'mobile-app-development': 'technology',
          
          // Medical Services
          'medical-services': 'medical',
          'dental-services': 'dental',
          'fitness-personal-training': 'fitness',
          
          // Education Services
          'tutoring-services': 'tutoring',
          'language-learning': 'language',
          
          // Event Services
          'event-planning': 'event',
          'photography-services': 'photography',
          'dj-entertainment': 'entertainment',
          
          // Financial Services
          'financial-planning': 'financial',
          'insurance-services': 'insurance',
          
          // Additional missing mappings from database
          'food-delivery': 'food',
          'home-cleaning': 'cleaning',
          'home-painting': 'painting',
          'home-repair-maintenance': 'repair',
          'it-support-services': 'technology',
          'marketing-services': 'marketing',
          'mobile-app-development': 'technology',
          'web-development': 'technology',
          
          // Other Services
          'other-services': 'other',
          'other': 'other',
          'miscellaneous': 'other',
          'specialized': 'other'
        };

        const businessType = businessTypeMap[category.slug] || 'other';
        
        // is category me active businesses count krne k liye
        const businessCount = await Business.countDocuments({
          $or: [
            { businessType: businessType, status: 'active' },
            { 'serviceCategory.slug': category.slug, status: 'active' }
          ]
        });

        return {
          ...category,
          businessCount: businessCount
        };
      })
    );

    const result = {
      categories: categoriesWithCounts,
      total: categoriesWithCounts.length,
      search: search || null,
      featured: featured === 'true',
      parent: parent || null
    };

    // cache abhi disabled hai

    res.json(result);

  } catch (error) {
    console.error('Get service categories error:', error);
    res.status(500).json({
      message: 'Server error while fetching service categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// category tree lane k liye
router.get('/tree', async (req, res) => {
  try {
    // cache abhi disabled hai

    const tree = await ServiceCategory.getCategoryTree();
    
    const result = {
      tree,
      total: tree.length
    };

    // Cache temporarily disabled for stability

    res.json(result);

  } catch (error) {
    console.error('Get category tree error:', error);
    res.status(500).json({
      message: 'Server error while fetching category tree',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// featured categories lane k liye
router.get('/featured', async (req, res) => {
  try {
    // cache abhi disabled hai

    const categories = await ServiceCategory.findFeatured()
      .populate('subCategories', 'name slug businessCount')
      .lean();

    const result = {
      categories,
      total: categories.length
    };

    // Cache temporarily disabled for stability

    res.json(result);

  } catch (error) {
    console.error('Get featured categories error:', error);
    res.status(500).json({
      message: 'Server error while fetching featured categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/service-categories/:id - Get single category
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    let category;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // MongoDB ObjectId
      category = await ServiceCategory.findById(id)
        .populate('parentCategory', 'name slug')
        .populate('subCategories', 'name slug businessCount')
        .populate('createdBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName');
    } else {
      // Slug
      category = await ServiceCategory.findOne({ slug: id })
        .populate('parentCategory', 'name slug')
        .populate('subCategories', 'name slug businessCount')
        .populate('createdBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName');
    }

    if (!category) {
      return res.status(404).json({
        message: 'Service category not found',
        error: 'The requested category does not exist'
      });
    }

    if (!category.isActive || category.approvalStatus !== 'approved') {
      return res.status(404).json({
        message: 'Category not available',
        error: 'This category is not currently available'
      });
    }

    res.json({ category });

  } catch (error) {
    console.error('Get service category error:', error);
    res.status(500).json({
      message: 'Server error while fetching service category',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});
module.exports = router;
