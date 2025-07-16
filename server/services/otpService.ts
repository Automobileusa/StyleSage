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
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save OTP to database
  await storage.createOtpCode({
    userId,
    code,
    purpose,
    expiresAt
  });

  // Send OTP via email
  await sendOtpEmail(userEmail, userName, code, purpose);

  return code;
}

export async function verifyOtp(
  userId: string,
  code: string,
  purpose: string
): Promise<boolean> {
  const otp = await storage.getValidOtpCode(userId, code, purpose);
  
  if (otp) {
    // Mark OTP as used
    await storage.markOtpCodeUsed(otp.id);
    return true;
  }
  
  return false;
}
