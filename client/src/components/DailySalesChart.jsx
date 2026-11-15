export default function DailySalesChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-slate-400">
        No daily sales data available.
      </div>
    );
  }

  // Find maximum value to normalize bar heights
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.sales || 0, d.udhaar || 0, d.repayments || 0)),
    100
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">7-Day Business Activity</h4>
          <p className="text-xs text-slate-500">Daily Cash Sales, Udhaar, and Repayments</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
            <span className="text-slate-600">Sales (₹)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
            <span className="text-slate-600">Udhaar (₹)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
            <span className="text-slate-600">Repaid (₹)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 items-end h-44 pt-4 pb-2 border-b border-slate-100">
        {data.map((item, index) => {
          const salesH = Math.min(100, Math.round(((item.sales || 0) / maxVal) * 100));
          const udhaarH = Math.min(100, Math.round(((item.udhaar || 0) / maxVal) * 100));
          const repayH = Math.min(100, Math.round(((item.repayments || 0) / maxVal) * 100));

          return (
            <div key={index} className="flex flex-col items-center h-full justify-end group">
              {/* Bars container */}
              <div className="w-full flex items-end justify-center gap-1 h-32">
                {/* Sales Bar */}
                <div
                  style={{ height: `${Math.max(salesH, 6)}%` }}
                  title={`Sales: ₹${item.sales}`}
                  className="w-2.5 bg-emerald-500 group-hover:bg-emerald-600 rounded-t transition-all"
                ></div>
                {/* Udhaar Bar */}
                <div
                  style={{ height: `${Math.max(udhaarH, 6)}%` }}
                  title={`Udhaar: ₹${item.udhaar}`}
                  className="w-2.5 bg-amber-400 group-hover:bg-amber-500 rounded-t transition-all"
                ></div>
                {/* Repayment Bar */}
                <div
                  style={{ height: `${Math.max(repayH, 6)}%` }}
                  title={`Repaid: ₹${item.repayments}`}
                  className="w-2.5 bg-blue-400 group-hover:bg-blue-500 rounded-t transition-all"
                ></div>
              </div>

              {/* Day Label */}
              <span className="mt-2 text-[11px] font-medium text-slate-500 group-hover:text-slate-900">
                {item.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
