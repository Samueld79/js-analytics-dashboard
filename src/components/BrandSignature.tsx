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
        alt="Growth Strategy"
        className="brand-mark"
      />
      <div className="brand-copy">
        <span className="brand-wordmark">
          Growth Strategy<span style={{ color: 'hsl(180,100%,50%)' }}>.</span>
        </span>
        {showSubtitle && <span className="brand-subline">{subtitle}</span>}
      </div>
    </div>
  );
}
