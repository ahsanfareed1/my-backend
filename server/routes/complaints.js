const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const Business = require('../models/Business');
const User = require('../models/user');
const nodemailer = require('nodemailer');

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// POST /api/complaints - Submit a new complaint (requires login)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      businessId,
      title,
      description,
      serviceCategory,
      severity,
      contactInfo,
      userEmail
    } = req.body;

    

    // Validate required fields
    if (!businessId || !title || !description || !serviceCategory) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: businessId, title, description, and serviceCategory are required'
      });
    }

    // Validate business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Use provided userEmail or fallback to user's email from token
    const emailToUse = userEmail || req.user.email;
    
    // Validate that we have an email
    if (!emailToUse) {
      return res.status(400).json({
        success: false,
        message: 'User email is required for complaint submission'
      });
    }

    // Create complaint
    const complaint = new Complaint({
      userId: req.user._id,
      userEmail: emailToUse,
      businessId,
      title: title.trim(),
      description: description.trim(),
      serviceCategory,
      severity: severity || 'medium',
      contactInfo: contactInfo || {}
    });

    await complaint.save();
    

    // Send confirmation email to user
    const userName = req.user.firstName || req.user.displayName || 'User';

    const confirmationEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .complaint-details { background: #e8f5e9; padding: 15px; margin: 15px 0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Complaint Submitted Successfully!</h2>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Your complaint has been submitted successfully and is now under review.</p>
            
            <div class="complaint-details">
              <h3>Complaint Details:</h3>
              <p><strong>Title:</strong> ${title}</p>
              <p><strong>Business:</strong> ${business.businessName}</p>
              <p><strong>Service Category:</strong> ${serviceCategory}</p>
              <p><strong>Severity:</strong> ${severity}</p>
              <p><strong>Reference Number:</strong> CP-${complaint._id.toString().slice(-6)}</p>
            </div>
            
            <p>Our team will review your complaint and take appropriate action. You will be notified of any updates.</p>
            <p>Thank you for helping us maintain quality standards.</p>
          </div>
          <div class="footer">
            <p>Sent from AAA Services Directory</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send confirmation email
    const mailOptions = {
      from: 'aaaservicesdirectory@gmail.com',
      to: emailToUse,
      subject: `Complaint Submitted - ${business.businessName}`,
      html: confirmationEmail
    };

    await transporter.sendMail(mailOptions);

    // Send notification email to business (if they have an email)
    if (business.contact?.email || business.email) {
      const businessEmail = business.contact?.email || business.email;
      
      const businessNotification = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .complaint-details { background: #ffebee; padding: 15px; margin: 15px 0; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Complaint Received</h2>
            </div>
            <div class="content">
              <p>A new complaint has been filed against your business.</p>
              
              <div class="complaint-details">
                <h3>Complaint Details:</h3>
                <p><strong>Title:</strong> ${title}</p>
                <p><strong>Service Category:</strong> ${serviceCategory}</p>
                <p><strong>Severity:</strong> ${severity}</p>
                <p><strong>Reference Number:</strong> CP-${complaint._id.toString().slice(-6)}</p>
              </div>
              
              <p>Please review this complaint and take appropriate action. Our team will also investigate and may contact you for additional information.</p>
              <p>Reference Number: CP-${complaint._id.toString().slice(-6)}</p>
            </div>
            <div class="footer">
              <p>Sent from AAA Services Directory</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const businessMailOptions = {
        from: 'aaaservicesdirectory@gmail.com',
        to: businessEmail,
        subject: `New Complaint Filed - ${title}`,
        html: businessNotification
      };

      await transporter.sendMail(businessMailOptions);
    }

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully! You will receive a confirmation email shortly.',
      complaintId: complaint._id,
      referenceNumber: `CP-${complaint._id.toString().slice(-6)}`
    });

  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});



// GET /api/complaints - Get all complaints for admin dashboard
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    
    
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      severity,
      serviceCategory,
      businessId,
      userId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (severity) query.severity = severity;
    if (serviceCategory) query.serviceCategory = serviceCategory;
    if (businessId) query.businessId = businessId;
    if (userId) query.userId = userId;

    

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with population for admin dashboard
    const complaints = await Complaint.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('businessId', 'businessName businessType location contact')
      .populate('adminNotes.adminId', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    

    // Get total count for pagination
    const total = await Complaint.countDocuments(query);

    // Get statistics for admin dashboard
    const stats = await Complaint.getStats();

    res.json({
      success: true,
      complaints,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalComplaints: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      },
      stats
    });

  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/complaints/:id - Get single complaint details (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone')
      .populate('businessId', 'businessName businessType location contact')
      .populate('adminNotes.adminId', 'firstName lastName');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      complaint
    });

  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PATCH /api/complaints/:id/status - Update complaint status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Update status
    await complaint.updateStatus(status, req.user._id, note);

    // Send update email to user if status changed
    if (complaint.status !== status) {
      const user = await User.findById(complaint.userId);
      if (user && user.email) {
        const statusUpdateEmail = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
              .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .status-update { background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Complaint Status Update</h2>
            </div>
            <div class="content">
              <p>Dear <strong>${user.firstName || 'User'}</strong>,</p>
              <p>Your complaint has been updated with a new status.</p>
              
              <div class="status-update">
                <h3>Status Update:</h3>
                <p><strong>Previous Status:</strong> ${complaint.status}</p>
                <p><strong>New Status:</strong> ${status}</p>
                ${note ? `<p><strong>Admin Note:</strong> ${note}</p>` : ''}
                <p><strong>Updated:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <p>We will continue to keep you updated on the progress of your complaint.</p>
            </div>
            <div class="footer">
              <p>Sent from AAA Services Directory</p>
            </div>
          </body>
          </html>
        `;

        const mailOptions = {
          from: 'aaaservicesdirectory@gmail.com',
          to: user.email,
          subject: `Complaint Status Updated - ${complaint.title}`,
          html: statusUpdateEmail
        };

        await transporter.sendMail(mailOptions);
      }
    }

    res.json({
      success: true,
      message: 'Complaint status updated successfully',
      complaint: {
        id: complaint._id,
        status: complaint.status,
        updatedAt: complaint.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PATCH /api/complaints/:id/resolve - Resolve complaint with action details (admin only)
router.patch('/:id/resolve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { actionTaken, resolutionNote } = req.body;

    if (!actionTaken) {
      return res.status(400).json({
        success: false,
        message: 'Action taken is required'
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Update complaint with resolution details
    complaint.status = 'resolved';
    complaint.resolution = {
      description: resolutionNote || '',
      resolvedBy: req.user._id,
      resolvedAt: new Date(),
      actionTaken: actionTaken
    };
    complaint.updatedAt = new Date();

    await complaint.save();

    // Send resolution email to user
    const user = await User.findById(complaint.userId);
    if (user && user.email) {
      const resolutionEmail = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .resolution { background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50; }
            .action-taken { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Complaint Resolved</h2>
          </div>
          <div class="content">
            <p>Dear <strong>${user.firstName || 'User'}</strong>,</p>
            <p>Great news! Your complaint has been resolved.</p>
            
            <div class="resolution">
              <h3>Resolution Details:</h3>
              <p><strong>Complaint:</strong> ${complaint.title}</p>
              <p><strong>Status:</strong> Resolved</p>
              <p><strong>Resolved On:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div class="action-taken">
              <h3>Action Taken:</h3>
              <p><strong>${actionTaken}</strong></p>
              ${resolutionNote ? `<p><strong>Additional Notes:</strong> ${resolutionNote}</p>` : ''}
            </div>
            
            <p>Thank you for bringing this matter to our attention. We appreciate your patience and understanding.</p>
            <p>If you have any further questions, please don't hesitate to contact us.</p>
          </div>
          <div class="footer">
            <p>Sent from AAA Services Directory</p>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: 'aaaservicesdirectory@gmail.com',
        to: user.email,
        subject: `Complaint Resolved - ${complaint.title}`,
        html: resolutionEmail
      };

      await transporter.sendMail(mailOptions);
    }

    res.json({
      success: true,
      message: 'Complaint resolved successfully',
      complaint: {
        id: complaint._id,
        status: complaint.status,
        resolution: complaint.resolution,
        updatedAt: complaint.updatedAt
      }
    });

  } catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve complaint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/complaints/:id/notes - Add admin note (admin only)
router.post('/:id/notes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        message: 'Note is required'
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    await complaint.addAdminNote(note, req.user._id);

    res.json({
      success: true,
      message: 'Note added successfully',
      complaint: {
        id: complaint._id,
        adminNotes: complaint.adminNotes
      }
    });

  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/complaints/user/my-complaints - Get user's own complaints
router.get('/user/my-complaints', authenticateToken, async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user._id })
      .populate('businessId', 'businessName businessType')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      complaints
    });

  } catch (error) {
    console.error('Error fetching user complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/complaints/health - Health check for complaints system
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const complaintCount = await Complaint.countDocuments();
    
    // Test model schema
    const testComplaint = new Complaint({
      userId: '000000000000000000000000', // Dummy ID
      userEmail: 'test@example.com',
      businessId: '000000000000000000000000', // Dummy ID
      title: 'Test Complaint',
      description: 'Test Description',
      serviceCategory: 'other'
    });
    
    // Check if validation works
    const validationError = testComplaint.validateSync();
    
    res.json({
      success: true,
      message: 'Complaints system is healthy',
      database: {
        connected: true,
        complaintCount: complaintCount
      },
      model: {
        valid: !validationError,
        schema: {
          hasUserEmail: testComplaint.schema.paths.userEmail !== undefined,
          userEmailRequired: testComplaint.schema.paths.userEmail?.isRequired || false
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Complaints system health check failed',
      error: error.message
    });
  }
});

// GET /api/complaints/fix-email - Fix existing complaints without userEmail (for migration)
router.get('/fix-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    
    
    // Find complaints without userEmail
    const complaintsWithoutEmail = await Complaint.find({ userEmail: { $exists: false } });
    
    
    let fixedCount = 0;
    
    for (const complaint of complaintsWithoutEmail) {
      try {
        // Get user from userId
        const user = await User.findById(complaint.userId);
        if (user && user.email) {
          complaint.userEmail = user.email;
          await complaint.save();
          fixedCount++;
          
        } else {
          
        }
      } catch (error) {
        console.error(`Error fixing complaint ${complaint._id}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Email fix completed. Fixed ${fixedCount} complaints.`,
      totalWithoutEmail: complaintsWithoutEmail.length,
      fixedCount: fixedCount
    });
    
  } catch (error) {
    console.error('Error in fix-email route:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing emails',
      error: error.message
    });
  }
});



module.exports = router;
