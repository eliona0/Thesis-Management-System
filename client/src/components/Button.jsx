export default function Button({ children, loading = false, disabled = false, className = '', ...props }) {
  return (
    <button className={`button ${className}`.trim()} disabled={disabled || loading} {...props}>
      {loading ? <><span className="spinner" aria-hidden="true" /> Please wait…</> : children}
    </button>
  )
}
