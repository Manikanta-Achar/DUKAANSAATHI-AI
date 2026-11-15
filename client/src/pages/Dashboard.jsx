import { Link } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import StatCard from '../components/StatCard.jsx';
import VoiceAssistant from '../components/VoiceAssistant.jsx';
import DailySalesChart from '../components/DailySalesChart.jsx';
import TransactionCard from '../components/TransactionCard.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import { useState } from 'react';
import api from '../api/api.js';
import {
  IndianRupee,
  Users,
  AlertTriangle,
  ShoppingBag,
  ArrowRight,
  PackagePlus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function Dashboard() {
  const { dashboard, loading, refreshAll, showToast } = useShop();

  const [selectedTxnToReverse, setSelectedTxnToReverse] = useState(null);
  const [isReversing, setIsReversing] = useState(false);

  const handleReverseConfirm = async () => {
    if (!selectedTxnToReverse) return;
    setIsReversing(true);
    try {
      const res = await api.post(`/api/transactions/${selectedTxnToReverse._id}/reverse`, {
        reason: 'Reversed via shopkeeper dashboard',
      });
      if (res.data?.success) {
        showToast('Transaction reversed successfully and ledger updated.', 'success');
        setSelectedTxnToReverse(null);
        await refreshAll();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reverse transaction', 'error');
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome to DukaanSaathi AI
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              <Sparkles className="w-3 h-3" /> Voice-First
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            "Speak. Record. Manage. — Your Shop, Your Voice."
          </p>
        </div>

        <button
          onClick={refreshAll}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Prominent Voice Assistant Hero Widget */}
      <VoiceAssistant />

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cash Sales"
          value={`₹${(dashboard.totalSales || 0).toLocaleString('en-IN')}`}
          subtitle="Direct sales collected"
          variant="emerald"
          icon={ShoppingBag}
        />
        <StatCard
          title="Outstanding Udhaar"
          value={`₹${(dashboard.outstandingUdhaar || 0).toLocaleString('en-IN')}`}
          subtitle="Pending customer credit"
          variant="amber"
          icon={IndianRupee}
          badge={dashboard.outstandingUdhaar > 0 ? 'Pending' : 'Zero Udhaar'}
        />
        <StatCard
          title="Total Customers"
          value={dashboard.totalCustomers || 0}
          subtitle="Active ledger accounts"
          variant="blue"
          icon={Users}
        />
        <StatCard
          title="Low Stock Items"
          value={dashboard.lowStockCount || 0}
          subtitle="Items needing restock"
          variant={dashboard.lowStockCount > 0 ? 'amber' : 'emerald'}
          icon={AlertTriangle}
          badge={dashboard.lowStockCount > 0 ? 'Action Needed' : 'Healthy'}
        />
      </div>

      {/* 7-Day Activity Chart */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <DailySalesChart data={dashboard.dailySales} />
      </div>

      {/* Two Column Grid: Recent Transactions & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
              <p className="text-xs text-slate-500">Latest credit, repayments, and sales</p>
            </div>
            <Link
              to="/history"
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {dashboard.recentTransactions?.length > 0 ? (
              dashboard.recentTransactions.map((txn) => (
                <TransactionCard
                  key={txn._id}
                  transaction={txn}
                  onReverse={(t) => setSelectedTxnToReverse(t)}
                />
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent transactions recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Low Stock Warnings</span>
                  {dashboard.lowStockCount > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {dashboard.lowStockCount} items
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">Products at or below reorder threshold</p>
              </div>
              <Link
                to="/inventory"
                className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                <span>Inventory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {dashboard.lowStockItems?.length > 0 ? (
                dashboard.lowStockItems.map((prod) => (
                  <div
                    key={prod._id}
                    className="flex items-center justify-between p-3 rounded-xl border border-amber-200/80 bg-amber-50/50"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{prod.name}</h4>
                      <p className="text-xs text-slate-500">
                        Price: ₹{prod.price} | Threshold: {prod.lowStockThreshold} {prod.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-700">
                        {prod.quantity} {prod.unit}
                      </span>
                      <p className="text-[10px] text-amber-600 font-medium">Low Stock</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  ✅ All inventory levels are healthy!
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              to="/inventory"
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Manage Stock in Inventory</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reversing a Transaction */}
      <ConfirmationModal
        isOpen={!!selectedTxnToReverse}
        title="Reverse Transaction Entry"
        message={`Are you sure you want to reverse this ${selectedTxnToReverse?.type} transaction of ${
          selectedTxnToReverse?.type === 'stock_adjustment'
            ? `${selectedTxnToReverse?.quantity} units`
            : `₹${selectedTxnToReverse?.amount}`
        } for "${selectedTxnToReverse?.customerName || selectedTxnToReverse?.productName}"? This will update the ledger and keep an audit record.`}
        confirmLabel={isReversing ? 'Reversing...' : 'Yes, Reverse Entry'}
        isDestructive={true}
        onConfirm={handleReverseConfirm}
        onCancel={() => setSelectedTxnToReverse(null)}
      />
    </div>
  );
}
