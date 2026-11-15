import { useState } from 'react';
import { useShop } from '../context/ShopContext.jsx';
import api from '../api/api.js';
import TransactionCard from '../components/TransactionCard.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import { Clock, Search, Filter, RotateCcw, ArrowUpDown } from 'lucide-react';

export default function History() {
  const { transactions, refreshTransactions, refreshDashboard, refreshCustomers, refreshProducts, showToast } =
    useShop();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'credit', 'repayment', 'sale', 'stock_adjustment'
  const [selectedTxnToReverse, setSelectedTxnToReverse] = useState(null);
  const [reversalReason, setReversalReason] = useState('Entry corrected by shopkeeper');
  const [isReversing, setIsReversing] = useState(false);

  const handleReverse = async () => {
    if (!selectedTxnToReverse) return;
    setIsReversing(true);
    try {
      const res = await api.post(`/api/transactions/${selectedTxnToReverse._id}/reverse`, {
        reason: reversalReason.trim() || 'Entry corrected by shopkeeper',
      });
      if (res.data?.success) {
        showToast('Transaction reversed and balance adjusted with audit record.', 'success');
        setSelectedTxnToReverse(null);
        await Promise.all([
          refreshTransactions(),
          refreshDashboard(),
          refreshCustomers(),
          refreshProducts(),
        ]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Reversal failed', 'error');
    } finally {
      setIsReversing(false);
    }
  };

  const filteredTransactions = transactions.filter((txn) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (txn.customerName && txn.customerName.toLowerCase().includes(q)) ||
      (txn.productName && txn.productName.toLowerCase().includes(q)) ||
      (txn.description && txn.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (filterType !== 'all' && txn.type !== filterType) return false;

    return true;
  });

  const filterTabs = [
    { id: 'all', label: 'All Transactions' },
    { id: 'credit', label: 'Udhaar (Credit)' },
    { id: 'repayment', label: 'Repayments' },
    { id: 'sale', label: 'Cash Sales' },
    { id: 'stock_adjustment', label: 'Stock Changes' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-700" />
            <span>Transaction History (लेन-देन का इतिहास)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete audit trail of all credit, repayments, sales, and stock movements
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 self-start sm:self-auto px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
          Total Entries: <span className="text-slate-900 font-bold">{transactions.length}</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer, product, or note (e.g. Ramesh, Milk)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2.5">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((txn) => (
            <TransactionCard
              key={txn._id}
              transaction={txn}
              onReverse={(t) => setSelectedTxnToReverse(t)}
            />
          ))
        ) : (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No transactions found matching criteria.</p>
            <p className="text-xs text-slate-400 mt-1">
              Transactions will appear here when you record udhaar, repayments, or sales.
            </p>
          </div>
        )}
      </div>

      {/* Reversal Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!selectedTxnToReverse}
        title="Reverse Transaction with Audit Trail"
        confirmLabel={isReversing ? 'Reversing...' : 'Confirm Reversal'}
        isDestructive={true}
        onConfirm={handleReverse}
        onCancel={() => setSelectedTxnToReverse(null)}
      >
        <div className="space-y-3">
          <p>
            Are you sure you want to reverse this{' '}
            <strong className="text-slate-900">{selectedTxnToReverse?.type}</strong> transaction of{' '}
            <strong className="text-slate-900">
              {selectedTxnToReverse?.type === 'stock_adjustment'
                ? `${selectedTxnToReverse?.quantity} units`
                : `₹${selectedTxnToReverse?.amount}`}
            </strong>{' '}
            for "{selectedTxnToReverse?.customerName || selectedTxnToReverse?.productName}"?
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for reversal (Audit Note)
            </label>
            <input
              type="text"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              placeholder="E.g. Incorrect amount entered by accident"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </ConfirmationModal>
    </div>
  );
}
