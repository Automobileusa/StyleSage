import { storage } from '../storage';
import { sendOtpEmail } from './emailService';

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createAndSendOtp(
  userId: string,
  userEmail: string,
  userName: string,
  purpose: string
): Promise<string> {
  // Input validation
  if (!userId || typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Invalid user ID');
  }

  if (!userEmail || typeof userEmail !== 'string' || userEmail.length === 0) {
    throw new Error('Invalid user email');
  }

  if (!userName || typeof userName !== 'string' || userName.length === 0) {
    throw new Error('Invalid user name');
  }

  if (!purpose || typeof purpose !== 'string' || purpose.length === 0) {
    throw new Error('Invalid purpose');
  }

  // Sanitize inputs
  const sanitizedUserId = userId.trim();
  const sanitizedUserEmail = userEmail.trim();
  const sanitizedUserName = userName.trim().substring(0, 100);
  const sanitizedPurpose = purpose.trim().substring(0, 50);

  // Check if user has too many recent OTP requests (rate limiting)
  try {
    const recentOtps = await storage.getRecentOtpCodes(sanitizedUserId, 5); // Get OTPs from last 5 minutes
    if (recentOtps && recentOtps.length >= 3) {
      throw new Error('Too many OTP requests. Please wait 5 minutes before requesting another.');
    }
  } catch (error) {
    if (error.message.includes('Too many OTP requests')) {
      throw error; // Re-throw rate limiting errors
    }
    console.error('Error checking recent OTPs:', error);
    // Continue with OTP generation if database check fails
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    // Save OTP to database
    await storage.createOtpCode({
      userId: sanitizedUserId,
      code,
      purpose: sanitizedPurpose,
      expiresAt
    });

    // Send OTP via email
    await sendOtpEmail(sanitizedUserEmail, sanitizedUserName, code, sanitizedPurpose);

    return code;
  } catch (error) {
    console.error('Error in createAndSendOtp:', error);
    
    // Try to clean up the OTP if email sending failed
    try {
      await storage.markOtpCodeUsed(code);
    } catch (cleanupError) {
      console.error('Error cleaning up failed OTP:', cleanupError);
    }
    
    throw error;
  }
}

export async function verifyOtp(
  userId: string,
  code: string,
  purpose: string
): Promise<boolean> {
  // Input validation
  if (!userId || typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Invalid user ID');
  }

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new Error('Invalid OTP code format');
  }

  if (!purpose || typeof purpose !== 'string' || purpose.length === 0) {
    throw new Error('Invalid purpose');
  }

  // Sanitize inputs
  const sanitizedUserId = userId.trim();
  const sanitizedCode = code.trim();
  const sanitizedPurpose = purpose.trim();

  try {
    const otp = await storage.getValidOtpCode(sanitizedUserId, sanitizedCode, sanitizedPurpose);
    
    if (otp) {
      try {
        // Mark OTP as used
        await storage.markOtpCodeUsed(otp.id);
        return true;
      } catch (markError) {
        console.error('Error marking OTP as used:', markError);
        // Still return true since the OTP was valid
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    throw new Error('OTP verification failed');
  }
}
