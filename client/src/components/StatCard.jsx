export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "emerald",
  badge,
}) {
  const variantStyles = {
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-100",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-700",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-100",
      iconBg: "bg-amber-100",
      iconText: "text-amber-700",
    },
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-100",
      iconBg: "bg-blue-100",
      iconText: "text-blue-700",
    },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-100",
      iconBg: "bg-purple-100",
      iconText: "text-purple-700",
    },
  };

  const style = variantStyles[variant] || variantStyles.emerald;

  return (
    <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-sm transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </p>
          <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {value}
          </h3>
        </div>
        {Icon && (
          <div
            className={`p-3 rounded-xl ${style.iconBg} ${style.iconText} shrink-0`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-slate-500">{subtitle}</span>
        {badge && (
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
