import { useState } from 'react';
import { ImageIcon, Video } from 'lucide-react';
import type { PortalAssetType } from '../lib/supabase';

// asset_type describes the underlying ad's creative format, not necessarily
// what's playable at asset_url — Meta's CDN thumbnail for a video ad is
// still a static JPEG. Always try to render the actual image first; only
// fall back to the type icon if the URL genuinely fails to load.
export function PortalCreativeThumb({
  assetUrl,
  assetType,
  size,
}: {
  assetUrl: string | null | undefined;
  assetType: PortalAssetType | undefined;
  size: number;
}) {
  const [failed, setFailed] = useState(false);

  if (assetUrl && !failed) {
    return (
      <img
        src={assetUrl}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  if (assetType === 'video') return <Video size={size} style={{ color: 'var(--fg-muted)' }} />;
  return <ImageIcon size={size} style={{ color: 'var(--fg-muted)' }} />;
}
