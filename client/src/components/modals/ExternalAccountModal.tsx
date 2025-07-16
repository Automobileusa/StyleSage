import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ExternalAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExternalAccountModal({ isOpen, onClose }: ExternalAccountModalProps) {
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    transitNumber: '',
    institutionNumber: '',
    accountHolderName: ''
  });
  const { toast } = useToast();

  const externalAccountMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/external-account', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "External Account Linking Initiated",
        description: `Micro-deposits of $${data.microDeposits.deposit1} and $${data.microDeposits.deposit2} will be sent for verification.`,
      });
      sessionStorage.setItem('pendingExternalAccountId', data.externalAccountId.toString());
      window.dispatchEvent(new CustomEvent('showOtpModal', { 
        detail: { action: 'External Account Linking', externalAccountId: data.externalAccountId } 
      }));
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "External Account Linking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      bankName: '',
      accountNumber: '',
      transitNumber: '',
      institutionNumber: '',
      accountHolderName: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    externalAccountMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--navy-blue)]">Link External Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="bankName" className="text-[var(--navy-blue)]">Bank Name</Label>
            <Input
              id="bankName"
              value={formData.bankName}
              onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="accountNumber" className="text-[var(--navy-blue)]">Account Number</Label>
            <Input
              id="accountNumber"
              value={formData.accountNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="transitNumber" className="text-[var(--navy-blue)]">Transit Number (5 digits)</Label>
            <Input
              id="transitNumber"
              maxLength={5}
              value={formData.transitNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, transitNumber: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="institutionNumber" className="text-[var(--navy-blue)]">Institution Number (3 digits)</Label>
            <Input
              id="institutionNumber"
              maxLength={3}
              value={formData.institutionNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, institutionNumber: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="accountHolderName" className="text-[var(--navy-blue)]">Account Holder Name</Label>
            <Input
              id="accountHolderName"
              value={formData.accountHolderName}
              onChange={(e) => setFormData(prev => ({ ...prev, accountHolderName: e.target.value }))}
              required
            />
          </div>
          
          <Button
            type="submit"
            className="w-full bg-[var(--primary-blue)] hover:bg-[var(--navy-blue)] text-white"
            disabled={externalAccountMutation.isPending}
          >
            {externalAccountMutation.isPending ? "Processing..." : "Link Account (Micro-deposit Verification)"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
