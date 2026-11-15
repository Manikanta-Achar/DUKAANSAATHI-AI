import { ArrowUpRight, ArrowDownLeft, RotateCcw, Box, ShoppingCart } from 'lucide-react';

export default function TransactionCard({ transaction, onReverse }) {
  const {
    _id,
    type,
    amount,
    quantity,
    customerName,
    productName,
    description,
    balanceAfter,
    isReversed,
    reverseReason,
    createdAt,
  } = transaction;

  const typeConfig = {
    credit: {
      label: 'Udhaar (Credit)',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: ArrowUpRight,
      iconColor: 'text-amber-600 bg-amber-50',
      amountPrefix: '+₹',
      amountClass: 'text-amber-700 font-bold',
    },
    repayment: {
      label: 'Repayment (Wapas)',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: ArrowDownLeft,
      iconColor: 'text-emerald-600 bg-emerald-50',
      amountPrefix: '-₹',
      amountClass: 'text-emerald-700 font-bold',
    },
    sale: {
      label: 'Cash Sale',
      badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
      icon: ShoppingCart,
      iconColor: 'text-teal-600 bg-teal-50',
      amountPrefix: '₹',
      amountClass: 'text-teal-700 font-bold',
    },
    stock_adjustment: {
      label: 'Stock Update',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Box,
      iconColor: 'text-blue-600 bg-blue-50',
      amountPrefix: quantity > 0 ? '+' : '',
      amountClass: 'text-blue-700 font-bold',
    },
  };

  const config = typeConfig[type] || typeConfig.credit;
  const Icon = config.icon;

  const dateFormatted = new Date(createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
        isReversed
          ? 'bg-slate-50/70 border-slate-200 opacity-60'
          : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Type Icon & Details */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl ${config.iconColor} shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 text-sm truncate">
                {customerName || productName || 'Shop Entry'}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${config.badgeBg}`}>
                {config.label}
              </span>
              {isReversed && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                  REVERSED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {description || (type === 'credit' ? 'Customer Udhaar' : 'Repayment')}
            </p>
          </div>
        </div>

        {/* Right: Amount/Quantity & Date/Reverse */}
        <div className="text-right shrink-0">
          <div className={`text-sm sm:text-base ${config.amountClass}`}>
            {type === 'stock_adjustment'
              ? `${config.amountPrefix}${quantity} units`
              : `${config.amountPrefix}${amount}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{dateFormatted}</div>

          {!isReversed && onReverse && (
            <button
              onClick={() => onReverse(transaction)}
              title="Reverse / Cancel entry safely"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reverse</span>
            </button>
          )}
        </div>
      </div>

      {isReversed && reverseReason && (
        <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-rose-700">
          Reason: {reverseReason}
        </div>
      )}
    </div>
  );
}
