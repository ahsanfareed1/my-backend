const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Business = require('../models/Business');
const Review = require('../models/Review');
const User = require('../models/user');

// helper: business rating recalc after hard delete
async function recalculateBusinessRating(businessId) {
  try {
    const Review = require('../models/Review');
    const Business = require('../models/Business');

    const reviews = await Review.find({ business: businessId, status: 'active' }).select('rating').lean();

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const key = (r.rating || 0).toString();
      if (ratingBreakdown[key] !== undefined) ratingBreakdown[key]++;
    }

    const total = reviews.length;
    const sum = Object.entries(ratingBreakdown).reduce((acc, [k, v]) => acc + parseInt(k, 10) * v, 0);
    const average = total > 0 ? sum / total : 0;

    await Business.findByIdAndUpdate(
      businessId,
      {
        $set: {
          'rating.average': average,
          'rating.totalReviews': total,
          'rating.ratingBreakdown': ratingBreakdown
        }
      },
      { new: true }
    );
  } catch (_) {
    // silent; rating will self-correct on future writes
  }
}

// gmail setup for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aaaservicesdirectory@gmail.com',
    pass: 'qggwfeapxfsqtlxo'
  }
});

// admin auth check krne k liye
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // checking if this is admin token
    if (decoded.adminId) {
      const admin = await Admin.findById(decoded.adminId);
      
      if (!admin || admin.status !== 'active') {
        return res.status(401).json({ message: 'Access denied. Invalid token.' });
      }

      req.admin = admin;
      req.userType = 'admin';
      next();
    }
    else {
      return res.status(401).json({ message: 'Access denied. Invalid token structure.' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid token.' });
  }
};



// admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username: username.toLowerCase() });
    
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: 'Invalid credentials or account inactive' });
    }

    // checking if password is set
    if (!admin.isPasswordSet) {
      return res.status(401).json({ message: 'Password not set. Please contact administrator.' });
    }

    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // updating last login time
    admin.lastLogin = new Date();
    await admin.save();

    // making jwt token
    const token = jwt.sign(
      { adminId: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions,
        profilePicture: admin.profilePicture,
        phone: admin.phone,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// getting dashboard numbers
router.get('/dashboard-stats', authenticateAdmin, async (req, res) => {
  try {
    const totalBusinesses = await Business.countDocuments();
    const pendingBusinesses = await Business.countDocuments({ status: 'pending' });
    const activeBusinesses = await Business.countDocuments({ status: 'active' });
    const totalReviews = await Review.countDocuments();
    const totalUsers = await User.countDocuments();
    
    // counting users by type
    const customerUsers = await User.countDocuments({ userType: 'customer' });
    const businessUsers = await User.countDocuments({ userType: 'business' });
    const adminUsers = await User.countDocuments({ userType: 'admin' });
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    const unverifiedUsers = await User.countDocuments({ emailVerified: false });
    
    // counting complaints
    const Complaint = require('../models/Complaint');
    const totalComplaints = await Complaint.countDocuments();

    res.json({
      totalBusinesses,
      pendingBusinesses,
      activeBusinesses,
      totalReviews,
      totalUsers,
      totalComplaints,
      customerUsers,
      businessUsers,
      adminUsers,
      verifiedUsers,
      unverifiedUsers
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
});

// getting all businesses
router.get('/service-providers', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email emailVerified')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Business.countDocuments(query);

    res.json({
      businesses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get service providers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// getting all complaints for admin
router.get('/complaints', authenticateAdmin, async (req, res) => {
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

    // adding filters
    if (status && status !== 'all') query.status = status;
    if (priority) query.priority = priority;
    if (severity) query.severity = severity;
    if (serviceCategory) query.serviceCategory = serviceCategory;
    if (businessId) query.businessId = businessId;
    if (userId) query.userId = userId;

    

    // making sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // getting complaints with user and business info
    const Complaint = require('../models/Complaint');
    const complaints = await Complaint.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('businessId', 'businessName businessType location contact')
      .populate('adminNotes.adminId', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    

    // counting total complaints
    const total = await Complaint.countDocuments(query);

    // getting complaint stats
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

// changing business status
router.patch('/service-providers/:id/status', authenticateAdmin, async (req, res) => {
  try {
    
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'pending', 'suspended', 'rejected', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    
    const business = await Business.findByIdAndUpdate(
      id,
      { 
        status,
        statusReason: reason,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.admin._id
      },
      { new: true }
    );

    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    res.json({ message: 'Status updated successfully', business });
  } catch (error) {
    console.error('Update business status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// removing business
router.delete('/service-providers/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const business = await Business.findByIdAndDelete(id);
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // also removing reviews for this business
    await Review.deleteMany({ business: id });

    res.json({ message: 'Business deleted successfully' });
  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// getting all reviews
router.get('/reviews', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { comment: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const reviews = await Review.find(query)
      .populate('reviewer', 'firstName lastName email')
      .populate('business', 'businessName businessType')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// changing review status
router.patch('/reviews/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'hidden', 'flagged', 'deleted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { 
        status,
        adminNotes: reason,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.admin._id
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review status updated successfully', review });
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// hard delete a review (admin only)
router.delete('/reviews/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id).select('business');
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const businessId = review.business;
    await Review.deleteOne({ _id: id });

    // recalc business rating after deletion
    if (businessId) {
      await recalculateBusinessRating(businessId);
    }

    res.json({ message: 'Review permanently deleted' });
  } catch (error) {
    console.error('Hard delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// changing complaint status
router.patch('/complaints/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!['pending', 'under_review', 'investigating', 'resolved', 'closed', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const Complaint = require('../models/Complaint');
    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { 
        status,
        $push: {
          adminNotes: {
            adminId: req.admin._id,
            note: note || `Status changed to ${status}`,
            timestamp: new Date()
          }
        },
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.admin._id
      },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json({ message: 'Complaint status updated successfully', complaint });
  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// fixing complaint
router.patch('/complaints/:id/resolve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { actionTaken, resolutionNote } = req.body;

    const Complaint = require('../models/Complaint');
    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { 
        status: 'resolved',
        resolution: {
          actionTaken,
          description: resolutionNote,
          resolvedAt: new Date(),
          resolvedBy: req.admin._id
        },
        $push: {
          adminNotes: {
            adminId: req.admin._id,
            note: `Complaint resolved: ${actionTaken}`,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // getting business info for email
    const populatedComplaint = await Complaint.findById(complaint._id)
      .populate('businessId', 'businessName businessType location');

    // sending email to user
    if (populatedComplaint.userEmail) {
      try {
        
        const resolutionEmail = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
              .resolution-details { background: #e8f5e9; padding: 15px; margin: 15px 0; border-radius: 8px; }
              .complaint-info { background: #f0f8ff; padding: 15px; margin: 15px 0; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Your Complaint Has Been Resolved!</h2>
              </div>
              <div class="content">
                <p>Dear User,</p>
                <p>Great news! Your complaint has been successfully resolved by our team.</p>
                
                <div class="complaint-info">
                  <h3>Complaint Details:</h3>
                  <p><strong>Title:</strong> ${populatedComplaint.title}</p>
                  <p><strong>Business:</strong> ${populatedComplaint.businessId?.businessName || 'N/A'}</p>
                  <p><strong>Service Category:</strong> ${populatedComplaint.serviceCategory}</p>
                  <p><strong>Reference Number:</strong> CP-${populatedComplaint._id.toString().slice(-6)}</p>
                </div>
                
                <div class="resolution-details">
                  <h3>Resolution Details:</h3>
                  <p><strong>Action Taken:</strong> ${actionTaken}</p>
                  ${resolutionNote ? `<p><strong>Additional Notes:</strong> ${resolutionNote}</p>` : ''}
                  <p><strong>Resolved On:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <p>We appreciate your patience and cooperation throughout this process. If you have any questions or concerns about the resolution, please don't hesitate to contact us.</p>
                <p>Thank you for helping us maintain quality standards.</p>
              </div>
              <div class="footer">
                <p>Sent from AAA Services Directory</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const mailOptions = {
          from: 'aaaservicesdirectory@gmail.com',
          to: populatedComplaint.userEmail,
          subject: `Complaint Resolved - ${populatedComplaint.title}`,
          html: resolutionEmail
        };
        
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error('Error sending resolution email:', emailError);
        // dont fail if email fails
      }
    } else {
      
    }

    res.json({ message: 'Complaint resolved successfully', complaint });
  } catch (error) {
    console.error('Resolve complaint error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// adding note to complaint
router.post('/complaints/:id/notes', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ message: 'Note is required' });
    }

    const Complaint = require('../models/Complaint');
    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { 
        $push: {
          adminNotes: {
            adminId: req.admin._id,
            note,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    res.json({ message: 'Note added successfully', complaint });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// getting admin profile
router.get('/profile', authenticateAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    res.json(admin);
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// getting all users with filters
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, userType, status, search } = req.query;
    
    let query = {};
    
    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    
    if (status && status !== 'all') {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      } else if (status === 'verified') {
        query.emailVerified = true;
      } else if (status === 'unverified') {
        query.emailVerified = false;
      }
    }
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -resetToken -resetTokenExpiry -emailVerificationToken -emailVerificationExpiry')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// getting user by id
router.get('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password -resetToken -resetTokenExpiry -emailVerificationToken -emailVerificationExpiry');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// updating user
router.patch('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, isActive, emailVerified, userType } = req.body;
    
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (emailVerified !== undefined) updateData.emailVerified = emailVerified;
    if (userType !== undefined) updateData.userType = userType;

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetToken -resetTokenExpiry -emailVerificationToken -emailVerificationExpiry');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// removing user
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // checking if user has businesses
    const businessCount = await Business.countDocuments({ owner: id });
    if (businessCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete user. User has associated businesses. Please delete businesses first.' 
      });
    }

    // checking if user has reviews
    const reviewCount = await Review.countDocuments({ reviewer: id });
    if (reviewCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete user. User has associated reviews. Please delete reviews first.' 
      });
    }

    // sending email about deletion
    try {
      const deletionEmail = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #ffc107; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Account Deletion Notice</h2>
            </div>
            <div class="content">
              <p>Dear ${user.firstName} ${user.lastName},</p>
              <p>Your account has been permanently deleted from AAA Services Directory by an administrator.</p>
              
              <div class="warning">
                <h3>Important Information:</h3>
                <p><strong>Account ID:</strong> ${user._id}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>User Type:</strong> ${user.userType}</p>
                <p><strong>Deletion Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <p>This action is irreversible. All your data, including profile information, preferences, and account settings, has been permanently removed from our system.</p>
              
              <p>If you believe this deletion was made in error, please contact our support team immediately.</p>
              
              <p>Thank you for using AAA Services Directory.</p>
            </div>
            <div class="footer">
              <p>Sent from AAA Services Directory</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: 'aaaservicesdirectory@gmail.com',
        to: user.email,
        subject: 'Account Deletion Notice - AAA Services Directory',
        html: deletionEmail
      };

      await transporter.sendMail(mailOptions);
      console.log('Deletion notification email sent to:', user.email);
    } catch (emailError) {
      console.error('Error sending deletion notification email:', emailError);
      // dont fail if email fails
    }

    // removing user
    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// logout (removing token from client)
router.post('/logout', authenticateAdmin, async (req, res) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==================== ADMIN USER MANAGEMENT ====================

// getting all admin users
router.get('/admin-users', authenticateAdmin, async (req, res) => {
  try {
    // only super admin can manage other admins
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied. Only super administrators can manage admin users.' });
    }

    const { page = 1, limit = 10, search = '', role = 'all' } = req.query;
    const skip = (page - 1) * limit;

    // making query
    let query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    if (role && role !== 'all') {
      query.role = role;
    }

    // counting total
    const total = await Admin.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // getting admin users
    const adminUsers = await Admin.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -passwordResetToken -passwordResetExpires');

    res.json({
      adminUsers,
      totalPages,
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// adding new admin user
router.post('/admin-users', authenticateAdmin, async (req, res) => {
  try {
    // only super admin can add other admins
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied. Only super administrators can add admin users.' });
    }

    const { username, email, fullName, role } = req.body;

    // checking required fields
    if (!username || !email || !fullName || !role) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // checking if username already exists
    const existingUsername = await Admin.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // checking if email already exists
    const existingEmail = await Admin.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // making new admin user
    const adminUser = new Admin({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      fullName,
      role,
      createdBy: req.admin._id
    });

    await adminUser.save();

    // making password setup token
    const resetToken = adminUser.generatePasswordResetToken();
    await adminUser.save();

    // sending password setup email
    const passwordSetupEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #228B22; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .button { display: inline-block; background: #228B22; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .info { background: #e7f3ff; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #228B22; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Welcome to AAA Services Directory</h2>
          </div>
          <div class="content">
            <p>Dear ${fullName},</p>
            <p>Welcome! You have been added as an administrator to the AAA Services Directory admin panel.</p>
            
            <div class="info">
              <h3>Your Account Details:</h3>
              <p><strong>Username:</strong> ${username}</p>
              <p><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
              <p><strong>Email:</strong> ${email}</p>
            </div>
            
            <p>To get started, you need to set up your password. Click the button below to set your password:</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/setup-password?token=${resetToken}" class="button">
              Set Your Password
            </a>
            
            <p><strong>Important:</strong> This link will expire in 24 hours for security reasons.</p>
            
            <p>After setting your password, you can log in at: <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/login">Admin Login Page</a></p>
            
            <p>If you have any questions or need assistance, please contact the administrator.</p>
            
            <p>Best regards,<br>AAA Services Directory Team</p>
          </div>
          <div class="footer">
            <p>Sent from AAA Services Directory</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: 'aaaservicesdirectory@gmail.com',
      to: email,
      subject: 'Welcome to AAA Services Directory - Set Your Password',
      html: passwordSetupEmail
    };

    await transporter.sendMail(mailOptions);
    console.log('Password setup email sent to:', email);

    // returning admin user data (without sensitive info)
    const adminData = adminUser.toJSON();
    res.status(201).json({
      message: 'Admin user added successfully',
      adminUser: adminData
    });
  } catch (error) {
    console.error('Add admin user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// updating admin user
router.patch('/admin-users/:id', authenticateAdmin, async (req, res) => {
  try {
    // only super admin can update other admins
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied. Only super administrators can update admin users.' });
    }

    const { id } = req.params;
    const updateData = req.body;

    // removing sensitive fields from update
    delete updateData.password;
    delete updateData.passwordResetToken;
    delete updateData.passwordResetExpires;

    // checking if admin user exists
    const adminUser = await Admin.findById(id);
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    // updating admin user
    const updatedAdminUser = await Admin.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpires');

    res.json({
      message: 'Admin user updated successfully',
      adminUser: updatedAdminUser
    });
  } catch (error) {
    console.error('Update admin user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// removing admin user
router.delete('/admin-users/:id', authenticateAdmin, async (req, res) => {
  try {
    // only super admin can remove other admins
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied. Only super administrators can delete admin users.' });
    }

    const { id } = req.params;

    // checking if admin user exists
    const adminUser = await Admin.findById(id);
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    // cant remove superadmin accounts
    if (adminUser.role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot delete superadmin accounts' });
    }

    // cant remove yourself
    if (id === req.admin._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // sending deletion email
    try {
      const deletionEmail = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #ffc107; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Admin Account Deletion Notice</h2>
            </div>
            <div class="content">
              <p>Dear ${adminUser.fullName},</p>
              <p>Your admin account has been permanently deleted from AAA Services Directory by a super administrator.</p>
              
              <div class="warning">
                <h3>Important Information:</h3>
                <p><strong>Account ID:</strong> ${adminUser._id}</p>
                <p><strong>Username:</strong> ${adminUser.username}</p>
                <p><strong>Email:</strong> ${adminUser.email}</p>
                <p><strong>Role:</strong> ${adminUser.role}</p>
                <p><strong>Deletion Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              
              <p>This action is irreversible. All your access to the admin panel has been permanently removed.</p>
              
              <p>If you believe this deletion was made in error, please contact the super administrator immediately.</p>
              
              <p>Thank you for your service.</p>
            </div>
            <div class="footer">
              <p>Sent from AAA Services Directory</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: 'aaaservicesdirectory@gmail.com',
        to: adminUser.email,
        subject: 'Admin Account Deletion Notice - AAA Services Directory',
        html: deletionEmail
      };

      await transporter.sendMail(mailOptions);
      console.log('Deletion notification email sent to:', adminUser.email);
    } catch (emailError) {
      console.error('Error sending deletion notification email:', emailError);
      // dont fail if email fails
    }

    // removing admin user
    await Admin.findByIdAndDelete(id);

    res.json({ message: 'Admin user deleted successfully' });
  } catch (error) {
    console.error('Delete admin user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// updating admin profile (self)
router.patch('/profile', authenticateAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, profilePicture } = req.body;
    const adminId = req.admin._id;
    
    // checking if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    
    // checking if email is already taken by another admin
    if (email && email !== admin.email) {
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: adminId } });
      if (existingAdmin) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }
    
    // updating profile
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { 
        fullName, 
        email, 
        phone, 
        profilePicture,
        updatedAt: new Date() 
      },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpires');
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      admin: updatedAdmin 
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// checking admin setup token
router.get('/admin-users/validate-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Validating admin token:', token);

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // finding admin by token
    const adminUser = await Admin.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    console.log('🔍 Admin user found:', adminUser ? 'Yes' : 'No');
    if (adminUser) {
      console.log('🔍 Token expires at:', new Date(adminUser.passwordResetExpires));
      console.log('🔍 Current time:', new Date());
      console.log('🔍 Token valid:', adminUser.passwordResetExpires > Date.now());
    }

    if (!adminUser) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // returning admin user info (without sensitive data)
    res.json({
      message: 'Token valid',
      adminUser: {
        id: adminUser._id,
        fullName: adminUser.fullName,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Validate admin token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// admin password setup
router.post('/admin-users/setup-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    console.log('Setting up password for admin token:', token);

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    // finding admin by token
    const adminUser = await Admin.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    console.log('Admin user found for password setup:', adminUser ? 'Yes' : 'No');

    if (!adminUser) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // hashing password and activating account
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // updating directly in database to avoid pre-save middleware issues
    await Admin.updateOne(
      { _id: adminUser._id },
      {
        $set: {
          password: hashedPassword,
          isPasswordSet: true,
          status: 'active',
          passwordResetToken: null,
          passwordResetExpires: null
        }
      }
    );

    console.log('Password set successfully for admin user:', adminUser.username);
    console.log('Admin user status set to active');

    res.json({ message: 'Password set successfully' });
  } catch (error) {
    console.error('Setup admin password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
