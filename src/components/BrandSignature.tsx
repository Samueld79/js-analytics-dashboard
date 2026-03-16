import brandLogo from '../assets/brand-logo.png';

type BrandSignatureProps = {
  subtitle?: string;
  compact?: boolean;
  showSubtitle?: boolean;
  className?: string;
};

export function BrandSignature({
  subtitle = 'Panel de crecimiento',
  compact = false,
  showSubtitle = true,
  className = '',
}: BrandSignatureProps) {
  return (
    <div className={`brand-signature ${compact ? 'compact' : ''} ${className}`.trim()}>
      <img
        src={brandLogo}
        alt="Growth Strategy JS"
        className="brand-mark"
      />
      <div className="brand-copy">
        <span className="brand-wordmark">Growth Strategy JS</span>
        {showSubtitle && <span className="brand-subline">{subtitle}</span>}
      </div>
    </div>
  );
}
