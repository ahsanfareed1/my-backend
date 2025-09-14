const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Business = require('../models/Business');

// gmail smtp transporter banane k liye
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aaaservicesdirectory@gmail.com',
    pass: 'qggwfeapxfsqtlxo'
  }
});

// inquiry submit krne k liye
router.post('/', async (req, res) => {
  try {
    const {
      businessId,
      customerName,
      customerEmail,
      customerPhone,
      message,
      serviceType,
      preferredDate,
      budget
    } = req.body;

    // Validate required fields
    if (!businessId || !customerName || !customerEmail || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: businessId, customerName, customerEmail, and message are required'
      });
    }

    // Find the business to get their email
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    // Get business email (fallback to contact email if available)
    const businessEmail = business.contact?.email || business.email;
    if (!businessEmail) {
      return res.status(400).json({
        success: false,
        message: 'Business email not found'
      });
    }

    // Create HTML email template
    const htmlEmail = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Inquiry Received</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 30px;
          }
          .inquiry-details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            margin-bottom: 15px;
            align-items: center;
          }
          .detail-label {
            font-weight: 600;
            color: #2E7D32;
            min-width: 120px;
            margin-right: 15px;
          }
          .detail-value {
            color: #333;
            flex: 1;
          }
          .message-box {
            background: #e8f5e9;
            border-left: 4px solid #4CAF50;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
          }
          .footer {
            background: #f1f8e9;
            padding: 20px;
            text-align: center;
            color: #2E7D32;
            font-size: 14px;
            border-top: 1px solid #e8f5e9;
          }
          .business-info {
            background: #fff3e0;
            border: 1px solid #ffcc02;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .cta-button {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin-top: 15px;
          }
          .cta-button:hover {
            background: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Inquiry Received</h1>
            <p>from ${customerName}</p>
          </div>
          
          <div class="content">
            <div class="business-info">
              <strong>Business:</strong> ${business.businessName || 'N/A'}<br>
              <strong>Location:</strong> ${business.location?.city || 'N/A'}
            </div>
            
            <div class="inquiry-details">
              <h3 style="color: #2E7D32; margin-top: 0;">Customer Details</h3>
              
              <div class="detail-row">
                <span class="detail-label">👤 Name:</span>
                <span class="detail-value">${customerName}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">📧 Email:</span>
                <span class="detail-value">${customerEmail}</span>
              </div>
              
              ${customerPhone ? `
              <div class="detail-row">
                <span class="detail-label">📱 Phone:</span>
                <span class="detail-value">${customerPhone}</span>
              </div>
              ` : ''}
              
              ${serviceType ? `
              <div class="detail-row">
                <span class="detail-label">Service:</span>
                <span class="detail-value">${serviceType}</span>
              </div>
              ` : ''}
              
              ${preferredDate ? `
              <div class="detail-row">
                <span class="detail-label">Preferred Date:</span>
                <span class="detail-value">${preferredDate}</span>
              </div>
              ` : ''}
              
              ${budget ? `
              <div class="detail-row">
                <span class="detail-label">Budget:</span>
                <span class="detail-value">${budget}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="message-box">
              <h4 style="color: #2E7D32; margin-top: 0;">Message:</h4>
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            
            <div style="text-align: center;">
              <a href="mailto:${customerEmail}" class="cta-button">Reply to Customer</a>
            </div>
          </div>
          
          <div class="footer">
            <strong>Sent from AAA Services Directory</strong><br>
            <small>Connecting customers with trusted service providers</small>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create plain text version
    const textEmail = `
New Inquiry Received from ${customerName}

Business: ${business.businessName || 'N/A'}
Location: ${business.location?.city || 'N/A'}

Customer Details:
- Name: ${customerName}
- Email: ${customerEmail}
${customerPhone ? `- Phone: ${customerPhone}` : ''}
${serviceType ? `- Service: ${serviceType}` : ''}
${preferredDate ? `- Preferred Date: ${preferredDate}` : ''}
${budget ? `- Budget: ${budget}` : ''}

Message:
${message}

---
Sent from AAA Services Directory
    `;

    // Send email to business
    const mailOptions = {
      from: 'aaaservicesdirectory@gmail.com',
      to: businessEmail,
      subject: `New Inquiry from ${customerName} - ${business.businessName}`,
      html: htmlEmail,
      text: textEmail
    };

    await transporter.sendMail(mailOptions);

    // Send confirmation email to customer
    const customerMailOptions = {
      from: 'aaaservicesdirectory@gmail.com',
      to: customerEmail,
      subject: `Inquiry Sent to ${business.businessName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Inquiry Sent Successfully!</h2>
            </div>
            <div class="content">
              <p>Dear ${customerName},</p>
              <p>Your inquiry has been sent to <strong>${business.businessName}</strong> successfully.</p>
              <p>They will contact you soon to discuss your requirements.</p>
              <p><strong>Your Message:</strong></p>
              <blockquote style="background: #e8f5e9; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0;">
                ${message}
              </blockquote>
            </div>
            <div class="footer">
              <p>Sent from AAA Services Directory</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(customerMailOptions);

    

    res.status(200).json({
      success: true,
      message: 'Inquiry sent successfully! The business will contact you soon.',
      businessName: business.businessName,
      businessEmail: businessEmail
    });

  } catch (error) {
    console.error('Error sending inquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send inquiry. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});



module.exports = router;
