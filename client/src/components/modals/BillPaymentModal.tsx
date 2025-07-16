import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface BillPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BillPaymentModal({ isOpen, onClose }: BillPaymentModalProps) {
  const [formData, setFormData] = useState({
    payeeName: '',
    payeeAddress: '',
    amount: '',
    paymentDate: ''
  });
  const { toast } = useToast();

  const billPaymentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/bill-payment', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bill Payment Initiated",
        description: "Please check your email for OTP verification.",
      });
      // Store bill payment ID for OTP verification
      sessionStorage.setItem('pendingBillPaymentId', data.billPaymentId.toString());
      // Trigger OTP modal (you'll need to implement this communication)
      window.dispatchEvent(new CustomEvent('showOtpModal', { 
        detail: { action: 'Bill Payment', billPaymentId: data.billPaymentId } 
      }));
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Bill Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      payeeName: '',
      payeeAddress: '',
      amount: '',
      paymentDate: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    billPaymentMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--navy-blue)]">Bill Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="payeeName" className="text-[var(--navy-blue)]">Payee Name</Label>
            <Input
              id="payeeName"
              value={formData.payeeName}
              onChange={(e) => setFormData(prev => ({ ...prev, payeeName: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="payeeAddress" className="text-[var(--navy-blue)]">Address</Label>
            <Textarea
              id="payeeAddress"
              value={formData.payeeAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, payeeAddress: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="amount" className="text-[var(--navy-blue)]">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="paymentDate" className="text-[var(--navy-blue)]">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
              required
            />
          </div>
          
          <Button
            type="submit"
            className="w-full bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white"
            disabled={billPaymentMutation.isPending}
          >
            {billPaymentMutation.isPending ? "Processing..." : "Continue to OTP Verification"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
