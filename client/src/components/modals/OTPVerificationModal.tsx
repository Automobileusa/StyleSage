import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Shield } from 'lucide-react';

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleShowOtpModal = (event: CustomEvent<OTPDetails>) => {
      setOtpDetails(event.detail);
      setIsOpen(true);
    };

    window.addEventListener('showOtpModal', handleShowOtpModal as EventListener);
    
    return () => {
      window.removeEventListener('showOtpModal', handleShowOtpModal as EventListener);
    };
  }, []);

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
    otpVerificationMutation.mutate({ code: otpCode });
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
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="6-digit OTP"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            className="text-center text-lg tracking-widest"
            required
          />
          
          <Button
            type="submit"
            className="w-full bg-[var(--accent-green)] hover:bg-green-600 text-white"
            disabled={otpVerificationMutation.isPending}
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
