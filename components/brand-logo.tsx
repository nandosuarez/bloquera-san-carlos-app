type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo-compact" : ""}`} aria-label="Bloquera San Carlos">
      <span className="brand-logo-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="brand-logo-text">BSC</span>
    </div>
  );
}
