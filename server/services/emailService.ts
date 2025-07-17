import nodemailer from 'nodemailer';

// SMTP configuration with improved error handling
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL for port 465
  auth: {
    user: 'exesoftware010@gmail.com',
    pass: 'lmgz etkx gude udar'
  },
  tls: {
    rejectUnauthorized: false
  }
});

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  // Input validation and sanitization
  if (!options.to || typeof options.to !== 'string') {
    throw new Error('Invalid recipient email address');
  }

  if (!options.subject || typeof options.subject !== 'string') {
    throw new Error('Invalid email subject');
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(options.to)) {
    throw new Error('Invalid email format');
  }

  // Sanitize inputs
  const sanitizedOptions = {
    to: options.to.trim(),
    subject: options.subject.trim().substring(0, 200), // Limit subject length
    text: options.text ? options.text.trim().substring(0, 10000) : undefined,
    html: options.html ? options.html.trim().substring(0, 50000) : undefined
  };

  const mailOptions = {
    from: 'exesoftware010@gmail.com',
    to: sanitizedOptions.to,
    subject: sanitizedOptions.subject,
    text: sanitizedOptions.text,
    html: sanitizedOptions.html
  };

  try {
    // Add timeout for email sending
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email send timeout')), 30000);
    });

    await Promise.race([emailPromise, timeoutPromise]);
    console.log(`Email sent successfully to ${sanitizedOptions.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    
    if (error.message === 'Email send timeout') {
      throw new Error('Email service timeout. Please try again.');
    }
    
    if (error.code === 'EAUTH' || error.code === 'ENOTFOUND') {
      throw new Error('Email authentication failed');
    }
    
    throw new Error('Failed to send email');
  }
}

export async function sendOtpEmail(
  userEmail: string,
  userName: string,
  otpCode: string,
  purpose: string = 'Login'
): Promise<void> {
  const subject = `East Coast Credit Union - OTP Verification`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0072ce 0%, #003e6b 100%); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">East Coast Credit Union</h1>
        <p style="color: white; margin: 5px 0;">Secure Online Banking</p>
      </div>

      <div style="padding: 30px; background: white;">
        <h2 style="color: #003e6b; margin-bottom: 20px;">OTP Verification Required</h2>

        <p>Dear ${userName},</p>

        <p>You have requested to perform the following action: <strong>${purpose}</strong></p>

        <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
          <p style="margin: 0; color: #6e6e6e;">Your verification code is:</p>
          <h1 style="color: #0072ce; font-size: 32px; letter-spacing: 8px; margin: 10px 0;">${otpCode}</h1>
          <p style="margin: 0; color: #6e6e6e; font-size: 14px;">This code expires in 10 minutes</p>
        </div>

        <p>If you did not request this verification, please contact us immediately.</p>

        <p>Best regards,<br>East Coast Credit Union Security Team</p>
      </div>

      <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #6e6e6e;">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>&copy; 2024 East Coast Credit Union. All rights reserved.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject,
    html
  });
}

export async function sendUserNotification(
  userEmail: string,
  userName: string,
  action: string,
  details: any
): Promise<void> {
  const subject = `East Coast Credit Union - ${action} Confirmation`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0072ce 0%, #003e6b 100%); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">East Coast Credit Union</h1>
        <p style="color: white; margin: 5px 0;">Secure Online Banking</p>
      </div>

      <div style="padding: 30px; background: white;">
        <h2 style="color: #003e6b; margin-bottom: 20px;">${action} Confirmation</h2>

        <p>Dear ${userName},</p>

        <p>Your ${action.toLowerCase()} request has been successfully processed.</p>

        <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3 style="color: #003e6b; margin-top: 0;">Details:</h3>
          ${Object.entries(details).map(([key, value]) => `
            <p style="margin: 5px 0;"><strong>${key}:</strong> ${value}</p>
          `).join('')}
        </div>

        <p>If you have any questions about this transaction, please contact our customer service team.</p>

        <p>Best regards,<br>East Coast Credit Union</p>
      </div>

      <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #6e6e6e;">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>&copy; 2024 East Coast Credit Union. All rights reserved.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject,
    html
  });
}

export async function sendAdminNotification(
  action: string,
  userData: any,
  additionalData?: any
): Promise<void> {
  const subject = `East Coast Credit Union - ${action} Request`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #003e6b; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">East Coast Credit Union</h1>
        <p style="color: white; margin: 5px 0;">Admin Notification</p>
      </div>

      <div style="padding: 30px; background: white;">
        <h2 style="color: #003e6b; margin-bottom: 20px;">${action} Request</h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Action:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${action}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">User:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${userData.firstName} ${userData.lastName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">User ID:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${userData.userId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">User Email:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${userData.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Time:</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date().toLocaleString()}</td>
          </tr>
        </table>

        ${additionalData ? `
          <h3 style="color: #003e6b; margin-top: 20px;">Request Details:</h3>
          <pre style="background: #f9f9f9; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(additionalData, null, 2)}</pre>
        ` : ''}
      </div>

      <div style="background: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #6e6e6e;">
        <p>&copy; 2024 East Coast Credit Union. All rights reserved.</p>
      </div>
    </div>
  `;

  await sendEmail({
    to: 'anncola401@gmail.com',
    subject,
    html
  });
}