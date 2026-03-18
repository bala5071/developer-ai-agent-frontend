// src/components/OutputPanel.jsx — Devron themed output panel

export default function OutputPanel({ outputs, activeTab, setActiveTab }) {
  const tabs = [
    { id: 'architecture', label: '// Architecture', content: outputs.architecture },
    { id: 'code',         label: '// Code',         content: outputs.code },
    { id: 'tests',        label: '// Test Report',  content: outputs.tests },
  ];

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      overflow: 'hidden',
      background: 'rgba(6,10,15,0.8)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(13,18,25,0.6)',
        padding: '0 4px',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => tab.content && setActiveTab(tab.id)}
            disabled={!tab.content}
            style={{
              padding: '12px 20px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              letterSpacing: '0.05em',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id
                ? '1px solid #00d4ff'
                : '1px solid transparent',
              color: activeTab === tab.id
                ? '#00d4ff'
                : tab.content ? '#3a4a5c' : '#1e2a38',
              cursor: tab.content ? 'pointer' : 'not-allowed',
              transition: 'color 0.2s',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        padding: '20px 24px',
        minHeight: '260px',
        maxHeight: '420px',
        overflowY: 'auto',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '13px',
        lineHeight: 1.8,
        color: '#4a5a6a',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {tabs.find(t => t.id === activeTab)?.content || (
          <span style={{ color: '#1e2a38', fontStyle: 'italic' }}>
            — awaiting agent output —
          </span>
        )}
      </div>
    </div>
  );
}