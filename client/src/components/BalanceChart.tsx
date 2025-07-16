import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface Account {
  id: number;
  accountType: string;
  balance: string;
  accountName: string;
}

interface BalanceChartProps {
  accounts: Account[];
}

export default function BalanceChart({ accounts }: BalanceChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || !accounts.length) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const chequingAccount = accounts.find(acc => acc.accountType === 'chequing');
    const savingsAccount = accounts.find(acc => acc.accountType === 'savings');

    // Sample data for the past 12 months
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const chequingBalance = chequingAccount ? parseFloat(chequingAccount.balance) : 0;
    const savingsBalance = savingsAccount ? parseFloat(savingsAccount.balance) : 0;

    // Generate sample historical data around current balances
    const chequingData = labels.map((_, index) => {
      const variation = (Math.random() - 0.5) * 50000; // ±25k variation
      return Math.max(0, chequingBalance + variation);
    });

    const savingsData = labels.map((_, index) => {
      const variation = (Math.random() - 0.5) * 10000; // ±5k variation
      return Math.max(0, savingsBalance + variation);
    });

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Chequing',
            data: chequingData,
            borderColor: 'hsl(207, 100%, 40%)',
            backgroundColor: 'hsla(207, 100%, 40%, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Savings',
            data: savingsData,
            borderColor: 'hsl(146, 100%, 33%)',
            backgroundColor: 'hsla(146, 100%, 33%, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [accounts]);

  return (
    <div className="relative h-64">
      <canvas ref={chartRef} />
    </div>
  );
}
