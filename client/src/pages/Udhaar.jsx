import { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext.jsx';
import api from '../api/api.js';
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import {
  Users,
  Search,
  UserPlus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  IndianRupee,
  Phone,
  RotateCcw,
  X,
  Plus,
  Minus,
  Edit2,
  Trash2,
  Archive,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ArchiveRestore,
} from 'lucide-react';

export default function Udhaar() {
  const {
    customers: allCustomers,
    customersLoading,
    refreshCustomers,
    refreshDashboard,
    refreshTransactions,
    showToast,
  } = useShop();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' or 'archived'

  const customers = allCustomers.filter((customer) => {
    const matchesStatus = statusFilter === 'archived' ? customer.isArchived === true : customer.isArchived !== true;
    const query = searchTerm.trim().toLowerCase();
    return matchesStatus && (!query || customer.name.toLowerCase().includes(query) || (customer.phone || '').includes(query));
  });
  const activeCount = allCustomers.filter((customer) => customer.isArchived !== true).length;
  const archivedCount = allCustomers.length - activeCount;
  // Customer Credit History Drawer
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState(null);
  const [customerHistoryList, setCustomerHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add new customer modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Edit Customer modal
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);

  // Delete / Archive Customer modal
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  // Transaction modals (Udhaar / Repay)
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [actionType, setActionType] = useState(null); // 'credit' or 'repay'
  const [amountInput, setAmountInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reverse confirmation
  const [txnToReverse, setTxnToReverse] = useState(null);

  // Reload customers whenever search or status filter changes
  useEffect(() => {
    refreshCustomers(searchTerm, statusFilter);
  }, [refreshCustomers]);

  // Open customer history ledger
  const handleOpenHistory = async (customer) => {
    setSelectedCustomerForHistory(customer);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/api/udhaar/customers/${customer._id}`);
      if (res.data?.success) {
        setCustomerHistoryList(res.data.data.history || []);
        setSelectedCustomerForHistory(res.data.data);
      }
    } catch (err) {
      showToast('Could not load history: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Add new customer
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      showToast('Please enter customer name', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/api/udhaar/customers', {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      });
      if (res.data?.success) {
        showToast(`Customer "${newCustomerName}" added to ledger!`, 'success');
        setNewCustomerName('');
        setNewCustomerPhone('');
        setIsAddCustomerOpen(false);
        await Promise.all([refreshCustomers(searchTerm, statusFilter), refreshDashboard()]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create customer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Customer modal
  const openEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.name || '');
    setEditCustomerPhone(customer.phone || '');
  };

  // Handle Edit Customer submit
  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    if (!editCustomerName.trim()) {
      showToast('Customer name is required', 'error');
      return;
    }
    setIsUpdatingCustomer(true);
    try {
      const res = await api.put(`/api/udhaar/customers/${editingCustomer._id}`, {
        name: editCustomerName.trim(),
        phone: editCustomerPhone.trim(),
      });
      if (res.data?.success) {
        showToast(`Customer "${editCustomerName}" updated successfully!`, 'success');
        setEditingCustomer(null);
        await Promise.all([
          refreshCustomers(searchTerm, statusFilter),
          refreshDashboard(),
          refreshTransactions(),
        ]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update customer', 'error');
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  // Handle Delete or Archive customer
  const handleDeleteOrArchive = async () => {
    if (!customerToDelete || isDeletingCustomer) return;

    setIsDeletingCustomer(true);
    try {
      const res = await api.delete(`/api/udhaar/customers/${customerToDelete._id}`);
      if (res.data?.success !== true || !['deleted', 'archived'].includes(res.data.action)) {
        throw new Error(res.data?.message || 'The server did not confirm the customer operation.');
      }

      const deletedName = customerToDelete.name;
      const operation = res.data.action;
      setCustomerToDelete(null);
      const [customersRefreshed] = await Promise.all([
        refreshCustomers(searchTerm, statusFilter),
        refreshDashboard(),
      ]);
      if (!customersRefreshed) {
        showToast(
          `Customer "${deletedName}" was ${operation}, but the customer list could not be refreshed.`,
          'error'
        );
        return;
      }

      showToast(
        operation === 'archived'
          ? `Customer "${deletedName}" safely archived.`
          : `Customer "${deletedName}" permanently deleted.`,
        'success'
      );
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  // Unarchive / Restore Customer
  const handleUnarchiveCustomer = async (customer) => {
    try {
      const res = await api.post(`/api/udhaar/customers/${customer._id}/unarchive`);
      if (res.data?.success) {
        showToast(`Customer "${customer.name}" restored to active ledger!`, 'success');
        await Promise.all([refreshCustomers(searchTerm, statusFilter), refreshDashboard()]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to restore customer', 'error');
    }
  };

  // Submit Udhaar or Repayment
  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    const val = Number(amountInput);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid positive amount', 'error');
      return;
    }

    if (actionType === 'repay' && val > Number(activeCustomer.totalUdhaar)) { showToast('Repayment cannot exceed the outstanding balance.', 'error'); return; }
    setSubmitting(true);
    try {
      const endpoint = actionType === 'credit' ? '/api/udhaar/credit' : '/api/udhaar/repay';
      const payload = {
        customerId: activeCustomer._id,
        customerName: activeCustomer.name,
        amount: val,
        description:
          descriptionInput.trim() ||
          (actionType === 'credit' ? `Udhaar entry ₹${val}` : `Repayment received ₹${val}`),
      };

      const res = await api.post(endpoint, payload);
      if (res.data?.success) {
        const actionLabel = actionType === 'credit' ? 'Udhaar added' : 'Repayment recorded';
        showToast(`${actionLabel} for ${activeCustomer.name} (₹${val})`, 'success');
        setActiveCustomer(null);
        setActionType(null);
        setAmountInput('');
        setDescriptionInput('');
        await Promise.all([
          refreshCustomers(searchTerm, statusFilter),
          refreshDashboard(),
          refreshTransactions(),
        ]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Transaction failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reverse transaction
  const handleReverseConfirm = async () => {
    if (!txnToReverse) return;
    try {
      const res = await api.post(`/api/transactions/${txnToReverse._id}/reverse`, {
        reason: 'Reversed from Udhaar Ledger view',
      });
      if (res.data?.success) {
        showToast('Transaction reversed and ledger updated.', 'success');
        setTxnToReverse(null);
        if (selectedCustomerForHistory) {
          handleOpenHistory(selectedCustomerForHistory);
        }
        await Promise.all([
          refreshCustomers(searchTerm, statusFilter),
          refreshDashboard(),
          refreshTransactions(),
        ]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Reversal failed', 'error');
    }
  };

  const totalOutstanding = customers.reduce((sum, c) => sum + (Number(c.totalUdhaar) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-700" />
            <span>Udhaar Ledger (खाता बही)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Record customer credits, repayments, and safely manage customer accounts
          </p>
        </div>

        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Search & Outstanding Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer by name or phone (e.g. Ramesh)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
              {statusFilter === 'active' ? 'Active Udhaar Pending' : 'Archived Udhaar Balance'}
            </span>
            <div className="text-xl font-black text-amber-900">
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="p-2.5 bg-amber-100 rounded-lg text-amber-800">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Status Filter Tabs (Active vs Archived) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Customers ({customersLoading ? '...' : activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'archived'
                ? 'bg-white text-amber-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archived Customers ({customersLoading ? '...' : archivedCount})</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 hidden sm:inline-block">
          {customers.length} customer account{customers.length !== 1 ? 's' : ''} listed
        </span>
      </div>

      {/* CUSTOMER LIST: Responsive Modern Table with Dedicated Actions Column */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Customer Details</th>
                <th className="py-3.5 px-4">Ledger Status</th>
                <th className="py-3.5 px-4">Outstanding Balance</th>
                <th className="py-3.5 px-4 text-center">Credit & Repayment</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {customersLoading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length > 0 ? (
                customers.map((cust) => {
                  const balance = Number(cust.totalUdhaar) || 0;
                  const hasUdhaar = balance > 0;
                  const isArchived = cust.isArchived === true;

                  return (
                    <tr
                      key={cust._id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isArchived ? 'bg-slate-50/40 opacity-75' : ''
                      }`}
                    >
                      {/* Customer Name & Phone */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-bold text-slate-900 text-sm sm:text-base">
                          {cust.name}
                        </div>
                        {cust.phone ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{cust.phone}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 mt-0.5">No phone number</div>
                        )}
                        {cust.transactionCount !== undefined && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {cust.transactionCount} total transaction{cust.transactionCount !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                            isArchived
                              ? 'bg-slate-100 text-slate-700 border-slate-300'
                              : hasUdhaar
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isArchived ? 'Archived' : hasUdhaar ? 'Udhaar Pending' : 'Clear'}
                        </span>
                      </td>

                      {/* Outstanding Balance */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span
                          className={`text-base sm:text-lg font-black ${
                            hasUdhaar ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          ₹{balance.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Quick Transactions */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!isArchived && (
                            <>
                              <button
                                onClick={() => {
                                  setActiveCustomer(cust);
                                  setActionType('credit');
                                  setAmountInput('');
                                  setDescriptionInput('');
                                }}
                                title="Add Udhaar"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Udhaar</span>
                              </button>

                              <button
                                onClick={() => {
                                  setActiveCustomer(cust);
                                  setActionType('repay');
                                  setAmountInput('');
                                  setDescriptionInput('');
                                }}
                                title="Record Repayment"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                                <span>Wapas</span>
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleOpenHistory(cust)}
                            title="View Credit Ledger History"
                            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* Actions Column with Edit and Delete/Archive */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {isArchived ? (
                            <button
                              onClick={() => handleUnarchiveCustomer(cust)}
                              title="Restore Customer to Active Ledger"
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Restore</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => openEditCustomer(cust)}
                                title="Edit Customer Details"
                                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setCustomerToDelete(cust)}
                                title="Delete or Archive Customer"
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium">
                      {statusFilter === 'archived'
                        ? 'No archived customers found.'
                        : 'No active customers found.'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {statusFilter === 'archived'
                        ? 'Customers you archive will appear here.'
                        : 'Add a customer above or speak: "Ramesh ko 40 rupaye udhaar do"'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Add New Customer */}
      <ConfirmationModal
        isOpen={isAddCustomerOpen}
        title="Add New Customer"
        confirmLabel={submitting ? 'Adding...' : 'Create Customer'}
        onConfirm={handleCreateCustomer}
        onCancel={() => setIsAddCustomerOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="E.g. Ramesh Kumar"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="E.g. 9876543210"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </ConfirmationModal>

      {/* MODAL 2: Edit Customer */}
      <ConfirmationModal
        isOpen={!!editingCustomer}
        title={`Edit Customer — ${editingCustomer?.name}`}
        confirmLabel={isUpdatingCustomer ? 'Saving...' : 'Save Changes'}
        onConfirm={handleUpdateCustomer}
        onCancel={() => setEditingCustomer(null)}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              required
              value={editCustomerName}
              onChange={(e) => setEditCustomerName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={editCustomerPhone}
              onChange={(e) => setEditCustomerPhone(e.target.value)}
              placeholder="E.g. 9876543210"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </ConfirmationModal>

      {/* MODAL 3: Smart Delete vs Safe Archive Confirmation Modal */}
      {customerToDelete && (() => {
        const hasBalance = Number(customerToDelete.totalUdhaar || 0) > 0;
        const hasHistory = (customerToDelete.transactionCount || 0) > 0;
        const mustArchive = hasBalance || hasHistory;

        return (
          <ConfirmationModal
            isOpen={true}
            title={mustArchive ? `Archive Customer — ${customerToDelete.name}` : `Delete Customer — ${customerToDelete.name}`}
            confirmLabel={
              isDeletingCustomer
                ? mustArchive
                  ? 'Archiving...'
                  : 'Deleting...'
                : mustArchive
                ? 'Archive Customer'
                : 'Permanently Delete'
            }
            isDestructive={!mustArchive}
            onConfirm={handleDeleteOrArchive}
            onCancel={() => !isDeletingCustomer && setCustomerToDelete(null)}
          >
            <div className="space-y-3">
              {mustArchive ? (
                <>
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-950">Financial Audit Protection Active</div>
                      <p className="leading-relaxed">
                        <strong>{customerToDelete.name}</strong> currently has{' '}
                        {hasBalance && (
                          <span className="font-semibold text-amber-900">
                            an outstanding balance of ₹{customerToDelete.totalUdhaar}
                          </span>
                        )}
                        {hasBalance && hasHistory && ' and '}
                        {hasHistory && (
                          <span className="font-semibold text-amber-900">
                            {customerToDelete.transactionCount} past transaction record(s)
                          </span>
                        )}
                        . To maintain accurate bookkeeping and transaction history, this customer
                        cannot be permanently deleted.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Would you like to safely <strong>Archive</strong> this customer instead?
                    <br />
                    • They will disappear from your active customer list.
                    <br />
                    • All past credit and repayment records will remain safely preserved in History.
                  </p>
                </>
              ) : (
                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    Are you sure you want to permanently delete <strong>{customerToDelete.name}</strong>?
                  </p>
                  <p className="text-slate-500">
                    This customer has no outstanding balance and no transaction history. This action
                    cannot be undone.
                  </p>
                </div>
              )}
            </div>
          </ConfirmationModal>
        );
      })()}

      {/* MODAL 4: Record Udhaar or Repayment */}
      <ConfirmationModal
        isOpen={!!activeCustomer && !!actionType}
        title={
          actionType === 'credit'
            ? `Add Udhaar — ${activeCustomer?.name}`
            : `Record Repayment — ${activeCustomer?.name}`
        }
        confirmLabel={
          submitting ? 'Recording...' : actionType === 'credit' ? 'Add Udhaar' : 'Save Repayment'
        }
        onConfirm={handleSubmitTransaction}
        onCancel={() => {
          setActiveCustomer(null);
          setActionType(null);
        }}
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between text-xs">
            <span className="text-slate-500">Current Balance:</span>
            <span className="font-bold text-slate-800">₹{activeCustomer?.totalUdhaar || 0}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (₹) *
            </label>
            <input
              type="number"
              min="1"
              required
              autoFocus
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="E.g. 40"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Note (Optional)
            </label>
            <input
              type="text"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder={actionType === 'credit' ? 'E.g. Chai and biscuits' : 'E.g. Paid in cash'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {amountInput && Number(amountInput) > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex justify-between">
              <span className="text-emerald-900 font-medium">New Balance After:</span>
              <span className="font-bold text-emerald-900">
                ₹
                {actionType === 'credit'
                  ? (
                      Number(activeCustomer?.totalUdhaar || 0) + Number(amountInput)
                    ).toLocaleString('en-IN')
                  : Math.max(
                      0,
                      Number(activeCustomer?.totalUdhaar || 0) - Number(amountInput)
                    ).toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      </ConfirmationModal>

      {/* DRAWER / MODAL 5: Customer History Ledger */}
      {selectedCustomerForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {selectedCustomerForHistory.name} — Credit Ledger
                </h3>
                <p className="text-xs text-slate-500">
                  Current Balance: ₹{selectedCustomerForHistory.totalUdhaar || 0}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerForHistory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {loadingHistory ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Loading ledger history...
                </div>
              ) : customerHistoryList.length > 0 ? (
                customerHistoryList.map((txn) => (
                  <div
                    key={txn._id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      txn.isReversed ? 'bg-slate-50 opacity-60' : 'bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            txn.type === 'credit'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {txn.type === 'credit' ? '+ Udhaar' : '- Repayment'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {txn.isReversed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                            REVERSED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{txn.description}</p>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-black text-sm ${
                          txn.type === 'credit' ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {txn.type === 'credit' ? `+₹${txn.amount}` : `-₹${txn.amount}`}
                      </div>
                      {!txn.isReversed && (
                        <button
                          onClick={() => setTxnToReverse(txn)}
                          className="mt-1 text-[11px] text-slate-400 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No credit transactions recorded yet for this customer.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reverse */}
      <ConfirmationModal
        isOpen={!!txnToReverse}
        title="Confirm Reverse Entry"
        message={`Reverse this ${txnToReverse?.type} of ₹${txnToReverse?.amount}? The customer balance will be adjusted accordingly with an audit record.`}
        confirmLabel="Yes, Reverse Entry"
        isDestructive={true}
        onConfirm={handleReverseConfirm}
        onCancel={() => setTxnToReverse(null)}
      />
    </div>
  );
}
