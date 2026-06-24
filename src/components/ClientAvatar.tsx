import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { updateClientLogo } from '../services/clients';

interface ClientAvatarProps {
  clientId: string;
  name: string;
  logoUrl?: string | null;
  size?: number;
  borderRadius?: number | string;
  editable?: boolean;
  onLogoChange?: (newUrl: string) => void;
}

const PALETTE = [
  '#06b6d4', '#8b5cf6', '#22c55e',
  '#f59e0b', '#ef4444', '#ec4899',
  '#3b82f6', '#10b981',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function ClientAvatar({
  clientId,
  name,
  logoUrl,
  size = 32,
  borderRadius = 8,
  editable = false,
  onLogoChange,
}: ClientAvatarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(logoUrl ?? null);

  // Sync when parent passes a fresh logoUrl (e.g. after reload)
  useEffect(() => {
    setCurrentUrl(logoUrl ?? null);
  }, [logoUrl]);

  const color = avatarColor(name);
  const initials = avatarInitials(name);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await updateClientLogo(clientId, file);
    setUploading(false);
    if (result.data) {
      setCurrentUrl(result.data.logo_url);
      onLogoChange?.(result.data.logo_url);
    }
    e.target.value = '';
  }

  const wrap: CSSProperties = {
    width: size,
    height: size,
    borderRadius,
    position: 'relative',
    flexShrink: 0,
    cursor: editable ? 'pointer' : 'default',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const overlayBase: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div
      style={wrap}
      onClick={editable ? () => fileRef.current?.click() : undefined}
      onMouseEnter={editable ? () => setHovered(true) : undefined}
      onMouseLeave={editable ? () => setHovered(false) : undefined}
      title={editable ? 'Cambiar foto' : name}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={
        editable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
            }
          : undefined
      }
      aria-label={editable ? `Cambiar foto de ${name}` : name}
    >
      {/* Base: logo image or initials */}
      {currentUrl ? (
        <img
          src={currentUrl}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: color + '22',
            border: `2px solid ${color}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: Math.round(size * 0.35),
              fontWeight: 800,
              color,
              fontFamily: 'Outfit, sans-serif',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Upload spinner */}
      {uploading && (
        <div style={{ ...overlayBase, background: 'oklch(0 0 0 / 0.6)' }}>
          <Loader2
            size={Math.max(12, Math.round(size * 0.4))}
            color="white"
            className="spin"
          />
        </div>
      )}

      {/* Hover camera overlay */}
      {editable && hovered && !uploading && (
        <div style={{ ...overlayBase, background: 'oklch(0 0 0 / 0.55)' }}>
          <Camera size={Math.max(12, Math.round(size * 0.38))} color="white" />
        </div>
      )}

      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void handleFile(e)}
        />
      )}
    </div>
  );
}
