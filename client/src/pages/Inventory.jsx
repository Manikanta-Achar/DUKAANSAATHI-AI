import { useState } from 'react';
import { useShop } from '../context/ShopContext.jsx';
import api from '../api/api.js';
import ConfirmationModal from '../components/ConfirmationModal.jsx';
import {
  Boxes,
  Search,
  PackagePlus,
  AlertTriangle,
  Plus,
  Minus,
  Edit2,
  Trash2,
  CheckCircle2,
  IndianRupee,
} from 'lucide-react';

export default function Inventory() {
  const { products, refreshProducts, refreshDashboard, refreshTransactions, showToast } =
    useShop();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'low', 'healthy'

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formUnit, setFormUnit] = useState('packets');
  const [formThreshold, setFormThreshold] = useState('5');
  const [submitting, setSubmitting] = useState(false);

  // Quick Stock Adjust Modal
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'reduce'
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState('');

  // Handle Create or Update product
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Product name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        // Update
        const res = await api.put(`/api/inventory/${editingProduct._id}`, {
          name: formName.trim(),
          price: Number(formPrice) || 0,
          quantity: Number(formQty) || 0,
          unit: formUnit.trim() || 'packets',
          lowStockThreshold: Number(formThreshold) || 5,
        });
        if (res.data?.success) {
          showToast(`Updated "${formName}" successfully!`, 'success');
          setEditingProduct(null);
        }
      } else {
        // Create
        const res = await api.post('/api/inventory', {
          name: formName.trim(),
          price: Number(formPrice) || 0,
          quantity: Number(formQty) || 0,
          unit: formUnit.trim() || 'packets',
          lowStockThreshold: Number(formThreshold) || 5,
        });
        if (res.data?.success) {
          showToast(`Added "${formName}" to inventory!`, 'success');
          setIsAddOpen(false);
        }
      }

      // Reset form
      setFormName('');
      setFormPrice('');
      setFormQty('');
      setFormUnit('packets');
      setFormThreshold('5');

      await Promise.all([refreshProducts(), refreshDashboard()]);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save product', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Product
  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    try {
      const res = await api.delete(`/api/inventory/${deletingProduct._id}`);
      if (res.data?.success) {
        showToast(`Removed "${deletingProduct.name}" from inventory`, 'success');
        setDeletingProduct(null);
        await Promise.all([refreshProducts(), refreshDashboard()]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  // Handle Quick Stock Adjust (+ or -)
  const handleAdjustStock = async () => {
    if (!adjustingProduct) return;
    const delta = Number(adjustQty);
    if (isNaN(delta) || delta <= 0) {
      showToast('Please enter a valid quantity', 'error');
      return;
    }

    const actualDelta = adjustType === 'add' ? delta : -delta;

    // Client-side negative inventory validation check
    if (adjustType === 'reduce' && delta > adjustingProduct.quantity) {
      showToast(
        `Cannot reduce by ${delta}. Available stock is only ${adjustingProduct.quantity} ${adjustingProduct.unit}.`,
        'error'
      );
      return;
    }

    try {
      const res = await api.post('/api/inventory/adjust', {
        productId: adjustingProduct._id,
        quantityDelta: actualDelta,
        reason: adjustReason.trim() || (adjustType === 'add' ? 'Stock restocked' : 'Stock reduced'),
      });

      if (res.data?.success) {
        const actionLabel = adjustType === 'add' ? 'Added' : 'Reduced';
        showToast(`${actionLabel} ${delta} ${adjustingProduct.unit} for "${adjustingProduct.name}"`, 'success');
        setAdjustingProduct(null);
        setAdjustQty('1');
        setAdjustReason('');
        await Promise.all([refreshProducts(), refreshDashboard(), refreshTransactions()]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Stock adjustment failed', 'error');
    }
  };

  // Open edit modal
  const openEdit = (prod) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormPrice(String(prod.price || 0));
    setFormQty(String(prod.quantity || 0));
    setFormUnit(prod.unit || 'packets');
    setFormThreshold(String(prod.lowStockThreshold || 5));
  };

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const isLow = Number(p.quantity) <= Number(p.lowStockThreshold);
    if (filterType === 'low') return isLow;
    if (filterType === 'healthy') return !isLow;
    return true;
  });

  const lowStockTotal = products.filter((p) => Number(p.quantity) <= Number(p.lowStockThreshold)).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-700" />
            <span>Inventory Management (स्टॉक)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor shop products, manage stock levels, and prevent stockouts
          </p>
        </div>

        <button
          onClick={() => {
            setFormName('');
            setFormPrice('');
            setFormQty('');
            setFormUnit('packets');
            setFormThreshold('5');
            setIsAddOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <PackagePlus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search, Filter Pills & Alert Summary */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products (Milk, Sugar, Chai Patti, Atta)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Items ({products.length})
          </button>
          <button
            onClick={() => setFilterType('low')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'low'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'text-amber-800 hover:text-amber-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock ({lowStockTotal})</span>
          </button>
          <button
            onClick={() => setFilterType('healthy')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterType === 'healthy' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            In Stock
          </button>
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((prod) => {
            const isLow = Number(prod.quantity) <= Number(prod.lowStockThreshold);

            return (
              <div
                key={prod._id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isLow
                    ? 'bg-gradient-to-b from-amber-50/40 to-white border-amber-300 shadow-xs'
                    : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{prod.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Price: <span className="font-semibold text-slate-800">₹{prod.price}</span> / {prod.unit}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isLow
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isLow ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      <span>{isLow ? 'Low Stock' : 'In Stock'}</span>
                    </span>
                  </div>

                  {/* Stock Quantity Display */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Available Quantity:</span>
                    <span
                      className={`text-xl font-black ${
                        isLow ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {prod.quantity} <span className="text-xs font-semibold text-slate-500">{prod.unit}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1">
                    Threshold: Reorder if &le; {prod.lowStockThreshold} {prod.unit}
                  </p>
                </div>

                {/* Quick Stock Adjust Buttons & Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <button
                      onClick={() => {
                        setAdjustingProduct(prod);
                        setAdjustType('add');
                        setAdjustQty('5');
                        setAdjustReason('');
                      }}
                      title="Add Stock"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Stock Add</span>
                    </button>

                    <button
                      onClick={() => {
                        setAdjustingProduct(prod);
                        setAdjustType('reduce');
                        setAdjustQty('1');
                        setAdjustReason('');
                      }}
                      title="Reduce Stock"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Reduce</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(prod)}
                      title="Edit Product"
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingProduct(prod)}
                      title="Delete Product"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No products found matching filters.</p>
            <p className="text-xs text-slate-400 mt-1">
              Add a product or say: "Milk ke 5 packet stock mein add karo"
            </p>
          </div>
        )}
      </div>

      {/* MODAL 1: Add or Edit Product */}
      <ConfirmationModal
        isOpen={isAddOpen || !!editingProduct}
        title={editingProduct ? `Edit ${editingProduct.name}` : 'Add New Product'}
        confirmLabel={submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add to Inventory'}
        onConfirm={handleSaveProduct}
        onCancel={() => {
          setIsAddOpen(false);
          setEditingProduct(null);
        }}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="E.g. Amul Taaza Milk, Tata Sugar, Red Label Tea"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="E.g. 32"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit
              </label>
              <input
                type="text"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                placeholder="packets, kg, litres"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Available Quantity *
              </label>
              <input
                type="number"
                min="0"
                value={formQty}
                onChange={(e) => setFormQty(e.target.value)}
                placeholder="E.g. 20"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Low Stock Threshold
              </label>
              <input
                type="number"
                min="1"
                value={formThreshold}
                onChange={(e) => setFormThreshold(e.target.value)}
                placeholder="E.g. 5"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>
      </ConfirmationModal>

      {/* MODAL 2: Quick Adjust Stock */}
      <ConfirmationModal
        isOpen={!!adjustingProduct}
        title={adjustType === 'add' ? `Add Stock — ${adjustingProduct?.name}` : `Reduce Stock — ${adjustingProduct?.name}`}
        confirmLabel={adjustType === 'add' ? 'Confirm Add Stock' : 'Confirm Reduce Stock'}
        isDestructive={adjustType === 'reduce'}
        onConfirm={handleAdjustStock}
        onCancel={() => setAdjustingProduct(null)}
      >
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between text-xs">
            <span className="text-slate-500">Current Stock:</span>
            <span className="font-bold text-slate-800">
              {adjustingProduct?.quantity} {adjustingProduct?.unit}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity to {adjustType === 'add' ? 'Add' : 'Reduce'} ({adjustingProduct?.unit}) *
            </label>
            <input
              type="number"
              min="1"
              required
              autoFocus
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Delivery Note (Optional)
            </label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="E.g. Morning delivery, counter sale, spoiled pack"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {adjustQty && Number(adjustQty) > 0 && (
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs flex justify-between">
              <span className="text-slate-700 font-medium">New Stock Level:</span>
              <span className="font-bold text-slate-900">
                {adjustType === 'add'
                  ? Number(adjustingProduct?.quantity || 0) + Number(adjustQty)
                  : Math.max(0, Number(adjustingProduct?.quantity || 0) - Number(adjustQty))}{' '}
                {adjustingProduct?.unit}
              </span>
            </div>
          )}
        </div>
      </ConfirmationModal>

      {/* MODAL 3: Delete Product Confirmation */}
      <ConfirmationModal
        isOpen={!!deletingProduct}
        title="Delete Product"
        message={`Are you sure you want to remove "${deletingProduct?.name}" from your shop inventory? This action cannot be undone.`}
        confirmLabel="Yes, Delete Product"
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingProduct(null)}
      />
    </div>
  );
}
