import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChequeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChequeOrderModal({ isOpen, onClose }: ChequeOrderModalProps) {
  const [formData, setFormData] = useState({
    accountId: '',
    deliveryAddress: '',
    quantity: ''
  });
  const { toast } = useToast();

  const { data: dashboardData } = useQuery({
    queryKey: ["/api/dashboard"],
  });

  const chequeOrderMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/cheque-order', {
        accountId: parseInt(data.accountId),
        deliveryAddress: data.deliveryAddress,
        quantity: parseInt(data.quantity)
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cheque Order Initiated",
        description: "Please check your email for OTP verification.",
      });
      sessionStorage.setItem('pendingChequeOrderId', data.chequeOrderId.toString());
      window.dispatchEvent(new CustomEvent('showOtpModal', { 
        detail: { action: 'Cheque Order', chequeOrderId: data.chequeOrderId } 
      }));
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Cheque Order Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      accountId: '',
      deliveryAddress: '',
      quantity: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    chequeOrderMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--navy-blue)]">Order Cheques</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="account" className="text-[var(--navy-blue)]">Account</Label>
            <Select value={formData.accountId} onValueChange={(value) => setFormData(prev => ({ ...prev, accountId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Account" />
              </SelectTrigger>
              <SelectContent>
                {dashboardData?.accounts?.map((account: any) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.accountName} ({account.accountNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="deliveryAddress" className="text-[var(--navy-blue)]">Delivery Address</Label>
            <Textarea
              id="deliveryAddress"
              value={formData.deliveryAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="quantity" className="text-[var(--navy-blue)]">Quantity</Label>
            <Select value={formData.quantity} onValueChange={(value) => setFormData(prev => ({ ...prev, quantity: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Quantity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 Cheques</SelectItem>
                <SelectItem value="50">50 Cheques</SelectItem>
                <SelectItem value="100">100 Cheques</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            type="submit"
            className="w-full bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white"
            disabled={chequeOrderMutation.isPending}
          >
            {chequeOrderMutation.isPending ? "Processing..." : "Continue to OTP Verification"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
