import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { University, User, Lock, Shield } from "lucide-react";

export default function LoginPage() {
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
    otpCode: ''
  });
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { userId: string; password: string }) => {
      const response = await apiRequest('POST', '/api/auth/login', data);
      return response.json();
    },
    onSuccess: () => {
      setStep('otp');
      toast({
        title: "OTP Sent",
        description: "Please check your email for the verification code.",
      });
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      let errorMessage = "Please check your credentials and try again.";

      if (error?.message) {
        if (error.message.includes("401") || error.message.includes("Unauthorized") || error.message.includes("Invalid credentials")) {
          errorMessage = "Invalid User ID or Password. Please check your credentials and try again.";
        } else if (error.message.includes("Network") || error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const otpMutation = useMutation({
    mutationFn: async (data: { code: string }) => {
      const response = await apiRequest('POST', '/api/auth/verify-otp', data);
      return response.json();
    },
    onSuccess: () => {
      window.location.reload(); // Refresh to update auth state
    },
    onError: (error: any) => {
      console.error("OTP verification error:", error);
      let errorMessage = "Please check your verification code and try again.";

      if (error?.message) {
        if (error.message.includes("401") || error.message.includes("Invalid OTP")) {
          errorMessage = "Invalid verification code. Please check the 6-digit code from your email and try again.";
        } else if (error.message.includes("expired")) {
          errorMessage = "Verification code has expired. Please request a new one.";
        } else if (error.message.includes("Network") || error.message.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Verification Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({
      userId: formData.userId,
      password: formData.password
    });
  };

  const handleOtpVerification = (e: React.FormEvent) => {
    e.preventDefault();
    otpMutation.mutate({
      code: formData.otpCode
    });
  };

  return (
    <div className="min-h-screen login-container flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-shadow">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex justify-center">
              <img 
                src="https://auth.eastcoastcu.ca/resources/themes/theme-eastcoast-md-refresh-mobile/assets/images/logo.png" 
                alt="East Coast Credit Union Logo"
                className="h-16 w-auto object-contain"
                onError={(e) => {
                  // Fallback to icon if logo fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.parentElement?.querySelector('.fallback-icon');
                  if (fallback) {
                    (fallback as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              <div className="fallback-icon w-16 h-16 bg-[var(--primary-blue)] rounded-full items-center justify-center" style={{ display: 'none' }}>
                <University className="text-white text-2xl" size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[var(--navy-blue)] mb-2">East Coast Credit Union</h1>
            <p className="text-[var(--text-gray)]">Secure Online Banking</p>
          </div>

          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative">
                <div className="input-icon">
                  <User size={16} />
                </div>
                <Input
                  type="text"
                  placeholder="User ID"
                  value={formData.userId}
                  onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>

              <div className="relative">
                <div className="input-icon">
                  <Lock size={16} />
                </div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white font-bold py-3"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpVerification} className="space-y-6">
              <div className="text-center">
                <Shield className="text-[var(--accent-green)] text-3xl mb-4 mx-auto" size={48} />
                <h2 className="text-xl font-bold text-[var(--navy-blue)] mb-2">Two-Factor Authentication</h2>
                <p className="text-[var(--text-gray)] mb-6">Please enter the 6-digit code sent to your email</p>
              </div>

              <div className="relative">
                <Input
                  type="text"
                  placeholder="6-digit OTP"
                  maxLength={6}
                  value={formData.otpCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, otpCode: e.target.value }))}
                  className="text-center text-lg tracking-widest"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[var(--accent-green)] hover:bg-green-600 text-white font-bold py-3"
                disabled={otpMutation.isPending}
              >
                {otpMutation.isPending ? "Verifying..." : "Verify & Continue"}
              </Button>
            </form>
          )}

          <div className="mt-8 text-center space-y-2">
            <a href="#" className="text-[var(--navy-blue)] hover:underline text-sm">Forgot Password?</a>
            <span className="text-[var(--text-gray)] mx-2">|</span>
            <a href="#" className="text-[var(--navy-blue)] hover:underline text-sm">Enroll</a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}