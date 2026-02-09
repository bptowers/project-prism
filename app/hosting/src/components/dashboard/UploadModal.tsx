import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUpload } from '@/hooks/useUpload';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME = {
  bgDeep: '#0f0e0d',
  bgSurface: '#1a1816',
  bgElevated: '#252220',
  bgOverlay: '#322e2b',
  textPrimary: '#e8e4df',
  textSecondary: '#b5aea5',
  textMuted: '#7a746c',
  accent: '#d4a574',
  accentEmphasis: '#c4956a',
  border: '#322e2b',
  borderEmphasis: '#453f3b',
  success: '#7eb563',
  error: '#c75d5d',
};

const PRISM_GRADIENT = 'linear-gradient(to right, #6ba3c7, #7eb563, #d4a574, #c75d5d)';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const { state, preview, error, provider, setProvider, parseFile, uploadAndAnalyze, reset } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return;
    setSelectedFile(file);
    parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleAnalyze = () => {
    if (selectedFile) uploadAndAnalyze(selectedFile);
  };

  const handleClose = () => {
    reset();
    setSelectedFile(null);
    onClose();
  };

  const handleReset = () => {
    reset();
    setSelectedFile(null);
  };

  const providerLabel = provider === 'claude' ? 'Claude (Anthropic)' : provider === 'gemini' ? 'Gemini (Google)' : 'GPT (OpenAI)';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              style={{
                width: '90vw',
                maxWidth: 560,
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: THEME.bgSurface,
                border: `1px solid ${THEME.border}`,
                borderRadius: 12,
                position: 'relative',
              }}
            >
              {/* Prism gradient bar */}
              <div style={{ height: 3, background: PRISM_GRADIENT, borderRadius: '12px 12px 0 0' }} />

              {/* Header */}
              <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: "'Playfair Display', serif", fontWeight: 700, color: THEME.textPrimary }}>
                    Upload Salesforce Export
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: THEME.textMuted }}>
                    CSV opportunity data for AI analysis
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  style={{
                    background: 'none', border: 'none', color: THEME.textMuted, fontSize: '1.5rem',
                    cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '20px 28px 28px' }}>

                {/* IDLE STATE — Drop zone + provider selector */}
                {state === 'idle' && !preview && (
                  <>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${dragOver ? THEME.accent : THEME.borderEmphasis}`,
                        borderRadius: 8,
                        padding: '40px 24px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: dragOver ? `${THEME.accent}10` : THEME.bgElevated,
                        transition: 'all 0.2s ease',
                        marginBottom: 20,
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>&#128206;</div>
                      <div style={{ fontSize: '0.95rem', color: THEME.textPrimary, fontWeight: 600 }}>
                        Drop your Salesforce export here
                      </div>
                      <div style={{ fontSize: '0.8rem', color: THEME.textMuted, marginTop: 6 }}>
                        or <span style={{ color: THEME.accent, textDecoration: 'underline' }}>click to browse</span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                      />
                    </div>

                    {/* Provider selector */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: '0.75rem', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
                        LLM Provider
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {(['claude', 'gemini', 'openai'] as const).map(p => (
                          <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', color: provider === p ? THEME.accent : THEME.textSecondary }}>
                            <input
                              type="radio"
                              name="provider"
                              checked={provider === p}
                              onChange={() => setProvider(p)}
                              style={{ accentColor: THEME.accent }}
                            />
                            {p === 'claude' ? 'Claude' : p === 'gemini' ? 'Gemini' : 'OpenAI'}
                            {p === 'claude' && <span style={{ fontSize: '0.65rem', color: THEME.success, fontWeight: 700, textTransform: 'uppercase' }}>Recommended</span>}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.7rem', color: THEME.textMuted }}>
                      Accepted: .csv — Salesforce Opportunity export
                    </div>
                  </>
                )}

                {/* PARSING STATE */}
                {state === 'parsing' && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '0.9rem', color: THEME.textPrimary, marginBottom: 16 }}>Parsing CSV...</div>
                    <div style={{ height: 4, background: THEME.bgElevated, borderRadius: 4, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ width: '70%' }}
                        transition={{ duration: 2, ease: 'easeInOut' }}
                        style={{ height: '100%', background: PRISM_GRADIENT, borderRadius: 4 }}
                      />
                    </div>
                  </div>
                )}

                {/* IDLE + PREVIEW — File parsed, ready to analyze */}
                {state === 'idle' && preview && (
                  <>
                    <div style={{
                      backgroundColor: THEME.bgElevated,
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 20,
                      border: `1px solid ${THEME.border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: THEME.textPrimary }}>
                          {preview.name}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: THEME.textMuted }}>
                          {formatBytes(preview.size)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rows</div>
                          <div style={{ fontSize: '1.1rem', color: THEME.accent, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{preview.rows.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Columns</div>
                          <div style={{ fontSize: '1.1rem', color: THEME.accent, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{preview.columns.length}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.65rem', color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Regions</div>
                          <div style={{ fontSize: '1.1rem', color: THEME.accent, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                            {preview.regions.length > 0 ? preview.regions.join(', ') : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Provider selector (compact) */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: THEME.textMuted, fontWeight: 600 }}>Provider:</span>
                      {(['claude', 'gemini', 'openai'] as const).map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.8rem', color: provider === p ? THEME.accent : THEME.textSecondary }}>
                          <input type="radio" name="provider2" checked={provider === p} onChange={() => setProvider(p)} style={{ accentColor: THEME.accent }} />
                          {p === 'claude' ? 'Claude' : p === 'gemini' ? 'Gemini' : 'OpenAI'}
                        </label>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={handleAnalyze}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 6, border: 'none',
                          background: THEME.accent, color: THEME.bgDeep, fontWeight: 700,
                          fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Source Sans 3', sans-serif",
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}
                      >
                        Analyze with {providerLabel}
                      </button>
                      <button
                        onClick={handleReset}
                        style={{
                          padding: '12px 20px', borderRadius: 6,
                          border: `1px solid ${THEME.border}`, background: 'none',
                          color: THEME.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {/* UPLOADING STATE */}
                {state === 'uploading' && (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'inline-block', width: 32, height: 32, border: `3px solid ${THEME.border}`, borderTopColor: THEME.accent, borderRadius: '50%', marginBottom: 16 }}
                    />
                    <div style={{ fontSize: '0.9rem', color: THEME.textPrimary }}>Uploading to Firebase Storage...</div>
                    <div style={{ height: 4, background: THEME.bgElevated, borderRadius: 4, overflow: 'hidden', marginTop: 16 }}>
                      <motion.div
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: '40%', height: '100%', background: PRISM_GRADIENT, borderRadius: 4 }}
                      />
                    </div>
                  </div>
                )}

                {/* ANALYZING STATE */}
                {state === 'analyzing' && (
                  <div style={{ textAlign: 'center', padding: '30px 0' }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'inline-block', width: 40, height: 40, border: `3px solid ${THEME.border}`, borderTopColor: THEME.accent, borderRadius: '50%', marginBottom: 16 }}
                    />
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ fontSize: '1rem', color: THEME.textPrimary, fontWeight: 600 }}
                    >
                      AI Analysis in Progress...
                    </motion.div>
                    <div style={{ fontSize: '0.8rem', color: THEME.textMuted, marginTop: 8 }}>
                      Using <strong style={{ color: THEME.accent }}>{providerLabel}</strong>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: THEME.textMuted, marginTop: 12 }}>
                      Estimated: 15-30 seconds
                    </div>
                  </div>
                )}

                {/* COMPLETE STATE */}
                {state === 'complete' && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                      style={{
                        width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                        backgroundColor: `${THEME.success}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', color: THEME.success }}>&#10003;</span>
                    </motion.div>
                    <div style={{ fontSize: '1.1rem', color: THEME.textPrimary, fontWeight: 700, marginBottom: 8 }}>
                      Analysis Complete
                    </div>

                    {preview && (
                      <div style={{
                        backgroundColor: THEME.bgElevated, borderRadius: 6, padding: 12, marginBottom: 20,
                        fontSize: '0.8rem', color: THEME.textSecondary,
                      }}>
                        <div><strong>{preview.rows.toLocaleString()}</strong> opportunities processed</div>
                        {preview.regions.length > 0 && (
                          <div style={{ marginTop: 4 }}>Regions: {preview.regions.join(', ')}</div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button
                        onClick={handleClose}
                        style={{
                          flex: 1, padding: '12px', borderRadius: 6, border: 'none',
                          background: THEME.accent, color: THEME.bgDeep, fontWeight: 700,
                          fontSize: '0.85rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}
                      >
                        View Report
                      </button>
                      <button
                        onClick={handleReset}
                        style={{
                          padding: '12px 20px', borderRadius: 6,
                          border: `1px solid ${THEME.border}`, background: 'none',
                          color: THEME.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
                        }}
                      >
                        Upload Another
                      </button>
                    </div>
                  </div>
                )}

                {/* ERROR STATE */}
                {state === 'error' && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                      backgroundColor: `${THEME.error}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '1.5rem', color: THEME.error }}>&#10007;</span>
                    </div>
                    <div style={{ fontSize: '1rem', color: THEME.textPrimary, fontWeight: 700, marginBottom: 8 }}>
                      Upload Failed
                    </div>
                    <div style={{ fontSize: '0.85rem', color: THEME.error, marginBottom: 20 }}>
                      {error || 'An unexpected error occurred.'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button
                        onClick={handleReset}
                        style={{
                          padding: '10px 24px', borderRadius: 6, border: 'none',
                          background: THEME.accent, color: THEME.bgDeep, fontWeight: 700,
                          fontSize: '0.85rem', cursor: 'pointer',
                        }}
                      >
                        Try Again
                      </button>
                      <button
                        onClick={handleClose}
                        style={{
                          padding: '10px 24px', borderRadius: 6,
                          border: `1px solid ${THEME.border}`, background: 'none',
                          color: THEME.textSecondary, fontSize: '0.8rem', cursor: 'pointer',
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
