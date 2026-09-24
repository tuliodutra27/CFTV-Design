'use client';

import { useState, type ReactNode } from 'react';

interface MenuSectionProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export default function MenuSection({ icon, label, children, defaultOpen = false, badge }: MenuSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: '1px solid #1e293b' }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: open ? 'rgba(56,189,248,0.08)' : 'transparent',
          border: 'none',
          borderLeft: open ? '3px solid #38bdf8' : '3px solid transparent',
          color: '#e2e8f0',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ width: 16, textAlign: 'center', color: '#38bdf8' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge !== undefined && (
          <span
            style={{
              background: '#38bdf8',
              color: '#0f172a',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {badge}
          </span>
        )}
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: '#64748b' }}>
          ›
        </span>
      </button>
      {open && (
        <div style={{ padding: '8px 14px 14px 34px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
}
