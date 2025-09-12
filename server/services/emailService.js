const nodemailer = require('nodemailer');

// Create transporter using Google SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetUrl, userName, userType = 'customer') => {
  try {
    const transporter = createTransporter();
    
    const subject = userType === 'business' 
      ? 'Business Password Reset Request - AAA Services'
      : 'Password Reset Request - AAA Services';
    
    const mailOptions = {
      from: `"AAA Services" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: #2c3e50; margin-bottom: 10px;">AAA Services</h2>
            <h3 style="color: #34495e; margin-bottom: 20px;">${userType === 'business' ? 'Business Password Reset Request' : 'Password Reset Request'}</h3>
          </div>
          
          <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 20px;">
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Hello ${userName || 'there'},
            </p>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password for your AAA Services account. 
              If you didn't make this request, you can safely ignore this email.
            </p>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              To reset your password, click the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #3b82f6; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 6px; font-weight: 500; 
                        display: inline-block; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Or copy and paste this link into your browser:
            </p>
            
            <p style="color: #3498db; font-size: 14px; word-break: break-all; margin: 15px 0;">
              ${resetUrl}
            </p>
            
            <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6;">
              <strong>Important:</strong> This link will expire in 1 hour for security reasons.
            </p>
            
            <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6;">
              If you have any questions or need assistance, please contact our support team.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
            <p>© 2024 AAA Services. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send welcome email (optional)
const sendWelcomeEmail = async (email, userName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"AAA Services" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Welcome to AAA Services!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: #2c3e50; margin-bottom: 10px;">Welcome to AAA Services!</h2>
            <p style="color: #34495e; font-size: 18px;">We're excited to have you on board!</p>
          </div>
          
          <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 20px;">
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Hello ${userName},
            </p>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Thank you for joining AAA Services! We're here to help you find the best service providers 
              and make your experience seamless and enjoyable.
            </p>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Here's what you can do next:
            </p>
            
            <ul style="color: #2c3e50; font-size: 16px; line-height: 1.8;">
              <li>Complete your profile</li>
              <li>Browse available services</li>
              <li>Book appointments with verified businesses</li>
              <li>Write reviews and share your experiences</li>
            </ul>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              If you have any questions or need assistance, don't hesitate to reach out to our support team.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
            <p>© 2024 AAA Services. All rights reserved.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome email as it's not critical
    return { success: false, error: error.message };
  }
};

// Send email verification email
const sendEmailVerificationEmail = async (email, verificationUrl, userName, userType = 'business') => {
  try {
    const transporter = createTransporter();
    
    const subject = userType === 'business' 
      ? 'Verify Your Business Email - AAA Services'
      : 'Verify Your Email - AAA Services';
    
    const mailOptions = {
      from: `"AAA Services" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: #2c3e50; margin-bottom: 10px;">AAA Services</h2>
            <h3 style="color: #34495e; margin-bottom: 20px;">${userType === 'business' ? 'Business Email Verification' : 'Email Verification'}</h3>
          </div>
          
          <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 20px;">
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Hello ${userName || 'there'},
            </p>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Thank you for registering with AAA Services! To complete your registration and verify your email address, 
              please click the verification button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #10b981; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 6px; font-weight: 500; 
                        display: inline-block; font-size: 16px;">
                Verify Email
              </a>
            </div>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Or copy and paste this link into your browser:
            </p>
            
            <p style="color: #3498db; font-size: 14px; word-break: break-all; margin: 15px 0;">
              ${verificationUrl}
            </p>
            
            <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6;">
              <strong>Important:</strong> This verification link will expire in 24 hours for security reasons.
            </p>
            
            <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6;">
              After verifying your email, you'll be able to access all features of your AAA Services account.
            </p>
            
            <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6;">
              If you have any questions or need assistance, please contact our support team.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
            <p>© 2024 AAA Services. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending email verification email:', error);
    throw new Error('Failed to send email verification email');
  }
};

// Send help center contact email to admin
const sendHelpCenterContactEmail = async (contactData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"AAA Services Help Center" <${process.env.GMAIL_USER}>`,
      to: 'aaaservicesdirectory@gmail.com',
      subject: `Help Center Contact: ${contactData.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: #2c3e50; margin-bottom: 10px;">AAA Services Help Center</h2>
            <h3 style="color: #34495e; margin-bottom: 20px;">New Contact Form Submission</h3>
          </div>
          
          <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 20px;">
            <div style="margin-bottom: 20px;">
              <h4 style="color: #2c3e50; margin-bottom: 10px;">Contact Information:</h4>
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
                <strong>Name:</strong> ${contactData.name}<br>
                <strong>Email:</strong> ${contactData.email}<br>
                <strong>Category:</strong> ${contactData.category}<br>
                <strong>Subject:</strong> ${contactData.subject}
              </p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <h4 style="color: #2c3e50; margin-bottom: 10px;">Message:</h4>
              <p style="color: #2c3e50; font-size: 16px; line-height: 1.6; background-color: #f8f9fa; padding: 15px; border-radius: 6px;">
                ${contactData.message}
              </p>
            </div>
            
            <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; border-left: 4px solid #228B22;">
              <p style="color: #155724; font-size: 14px; margin: 0;">
                <strong>Action Required:</strong> Please respond to this inquiry within a few hours as promised.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
            <p>© 2024 AAA Services. All rights reserved.</p>
            <p>This is an automated email from the help center contact form.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Help center contact email sent to admin:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending help center contact email to admin:', error);
    throw new Error('Failed to send help center contact email to admin');
  }
};

// Send confirmation email to user
const sendHelpCenterConfirmationEmail = async (contactData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"AAA Services Help Center" <${process.env.GMAIL_USER}>`,
      to: contactData.email,
      subject: 'We\'ve received your inquiry - AAA Services',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
            <h2 style="color: #2c3e50; margin-bottom: 10px;">AAA Services Help Center</h2>
            <h3 style="color: #34495e; margin-bottom: 20px;">Thank you for contacting us!</h3>
          </div>
          
          <div style="padding: 20px; background-color: white; border-radius: 8px; margin-top: 20px;">
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Hello ${contactData.name},
            </p>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              We have received your inquiry and our support team will get back to you within a few hours.
            </p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4 style="color: #2c3e50; margin-bottom: 10px;">Your inquiry details:</h4>
              <p style="color: #2c3e50; font-size: 14px; line-height: 1.6; margin: 0;">
                <strong>Category:</strong> ${contactData.category}<br>
                <strong>Subject:</strong> ${contactData.subject}<br>
                <strong>Message:</strong> ${contactData.message}
              </p>
            </div>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              In the meantime, you can also check our <a href="/faq" style="color: #228B22;">FAQ page</a> for quick answers to common questions.
            </p>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              If you have any urgent concerns, you can also reach us at:
            </p>
            
            <ul style="color: #2c3e50; font-size: 16px; line-height: 1.8;">
              <li>Phone: +923224399586 (24/7)</li>
              <li>Email: aaaservicesdirectory@gmail.com</li>
            </ul>
            
            <p style="color: #2c3e50; font-size: 16px; line-height: 1.6;">
              Thank you for choosing AAA Services. We appreciate your patience and look forward to helping you!
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #7f8c8d; font-size: 12px;">
            <p>© 2024 AAA Services. All rights reserved.</p>
            <p>This is an automated confirmation email, please do not reply.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Help center confirmation email sent to user:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('Error sending help center confirmation email to user:', error);
    throw new Error('Failed to send help center confirmation email to user');
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEmailVerificationEmail,
  sendHelpCenterContactEmail,
  sendHelpCenterConfirmationEmail
};
