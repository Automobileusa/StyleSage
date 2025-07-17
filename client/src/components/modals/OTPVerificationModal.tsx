import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Shield, Timer } from 'lucide-react';

interface OTPDetails {
  action: string;
  billPaymentId?: number;
  chequeOrderId?: number;
  externalAccountId?: number;
}

export default function OTPVerificationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpDetails, setOtpDetails] = useState<OTPDetails | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShowOtpModal = (event: CustomEvent<OTPDetails>) => {
      setOtpDetails(event.detail);
      setIsOpen(true);
      setTimeLeft(600);
      setIsExpired(false);
      setOtpCode('');
    };

    window.addEventListener('showOtpModal', handleShowOtpModal as EventListener);
    
    return () => {
      window.removeEventListener('showOtpModal', handleShowOtpModal as EventListener);
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) {
      if (timeLeft <= 0) {
        setIsExpired(true);
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const otpVerificationMutation = useMutation({
    mutationFn: async (data: { code: string; [key: string]: any }) => {
      let endpoint = '';
      
      if (otpDetails?.billPaymentId) {
        endpoint = '/api/bill-payment/verify';
        data.billPaymentId = otpDetails.billPaymentId;
      } else if (otpDetails?.chequeOrderId) {
        endpoint = '/api/cheque-order/verify';
        data.chequeOrderId = otpDetails.chequeOrderId;
      } else if (otpDetails?.externalAccountId) {
        endpoint = '/api/external-account/verify';
        data.externalAccountId = otpDetails.externalAccountId;
      }
      
      const response = await apiRequest('POST', endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification Successful",
        description: `${otpDetails?.action} completed successfully!`,
      });
      
      // Refresh dashboard data
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      // Clear session storage
      sessionStorage.removeItem('pendingBillPaymentId');
      sessionStorage.removeItem('pendingChequeOrderId');
      sessionStorage.removeItem('pendingExternalAccountId');
      
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isExpired) {
      toast({
        title: "Code Expired",
        description: "The verification code has expired. Please request a new one.",
        variant: "destructive",
      });
      return;
    }

    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit code.",
        variant: "destructive",
      });
      return;
    }
    
    otpVerificationMutation.mutate({ code: otpCode });
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpCode(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    setIsOpen(false);
    setOtpCode('');
    setOtpDetails(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-[var(--accent-green)] rounded-full flex items-center justify-center mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <DialogTitle className="text-[var(--navy-blue)]">OTP Verification Required</DialogTitle>
          <p className="text-[var(--text-gray)] mt-2">Please enter the 6-digit code sent to your email</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Timer size={16} className={isExpired ? "text-red-500" : "text-[var(--accent-green)]"} />
            <span className={`text-sm font-mono ${isExpired ? "text-red-500" : "text-[var(--accent-green)]"}`}>
              {isExpired ? "Expired" : formatTime(timeLeft)}
            </span>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            ref={inputRef}
            type="text"
            placeholder="000000"
            maxLength={6}
            value={otpCode}
            onChange={handleOtpChange}
            className={`text-center text-xl tracking-widest font-mono ${
              isExpired ? "border-red-500 bg-red-50" : ""
            }`}
            disabled={isExpired || otpVerificationMutation.isPending}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="\d{6}"
            required
          />
          
          <Button
            type="submit"
            className="w-full bg-[var(--accent-green)] hover:bg-green-600 text-white disabled:opacity-50"
            disabled={otpVerificationMutation.isPending || isExpired || otpCode.length !== 6}
          >
            {otpVerificationMutation.isPending ? "Verifying..." : "Verify & Complete Transaction"}
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleClose}
          >
            Cancel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
