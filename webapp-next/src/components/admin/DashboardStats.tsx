import { CpuIcon, ShoppingCart, IndianRupee, Activity } from 'lucide-react';

interface Props {
  totalMachines:  number;
  activeMachines: number;
  ordersToday:    number;
  revenueToday:   number; // in paise
}

interface StatCardProps {
  label: string;
  value: string;
  icon:  React.ReactNode;
  sub?:  string;
}

function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider font-medium mb-1.5">
            {label}
          </p>
          <p className="text-white text-2xl font-bold">{value}</p>
          {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-coffee-500/15 text-coffee-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardStats({ totalMachines, activeMachines, ordersToday, revenueToday }: Props) {
  const rupees = (revenueToday / 100).toFixed(2);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="Total Machines"
        value={String(totalMachines)}
        icon={<CpuIcon size={18} />}
        sub={`${activeMachines} active`}
      />
      <StatCard
        label="Active Machines"
        value={String(activeMachines)}
        icon={<Activity size={18} />}
      />
      <StatCard
        label="Orders Today"
        value={String(ordersToday)}
        icon={<ShoppingCart size={18} />}
      />
      <StatCard
        label="Revenue Today"
        value={`₹${rupees}`}
        icon={<IndianRupee size={18} />}
      />
    </div>
  );
}
