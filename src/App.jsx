import { useState, useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import AgentCard from './components/AgentCard';
import OutputPanel from './components/OutputPanel';

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */
const API_URL = import.meta.env.VITE_API_URL;
const POLL_MS = 2000;

const STATUS_TO_AGENT = {
  creating_repo:                'github',
  planning:                     'architect',
  waiting_plan_approval:        'architect',
  developing:                   'developer',
  testing:                      'tester',
  deploying:                    'github',
  waiting_review:               null,
  processing_feedback:          'architect',
  waiting_improvement_approval: 'architect',
  implementing:                 'developer',
  validating:                   'tester',
  deploying_changes:            'github',
  complete:                     null,
  error:                        null,
};

const STATUS_DONE_AGENTS = {
  developing:                   ['architect'],
  testing:                      ['architect', 'developer'],
  deploying:                    ['architect', 'developer', 'tester'],
  waiting_review:               ['architect', 'developer', 'tester', 'github'],
  processing_feedback:          ['architect', 'developer', 'tester', 'github'],
  waiting_improvement_approval: ['architect', 'developer', 'tester', 'github'],
  implementing:                 ['architect'],
  validating:                   ['architect', 'developer'],
  deploying_changes:            ['architect', 'developer', 'tester'],
  complete:                     ['architect', 'developer', 'tester', 'github'],
};

const WAITING = new Set([
  'waiting_plan_approval',
  'waiting_review',
  'waiting_improvement_approval',
]);

/* ─── INLINE STYLES (CSS-in-JS) ─────────────────────────────────────────── */
const S = {
  /* Layout */
  page: {
    minHeight: '100vh',
    position: 'relative',
  },

  /* ── HERO ── */
  hero: {
    position: 'relative',
    paddingTop: '72px',
    paddingBottom: '56px',
    textAlign: 'center',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: '-80px', left: '50%',
    transform: 'translateX(-50%)',
    width: '600px', height: '300px',
    background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  wordmark: {
    fontFamily: "'Orbitron', monospace",
    fontSize: 'clamp(42px, 8vw, 88px)',
    fontWeight: 900,
    letterSpacing: '0.12em',
    lineHeight: 1,
    background: 'linear-gradient(135deg, #ffffff 0%, #00d4ff 50%, #0066ff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'glow-in 0.8s ease both',
    marginBottom: '16px',
    display: 'block',
  },
  tagline: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '15px',
    fontWeight: 300,
    color: '#5a6a80',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    animation: 'fadeUp 0.9s ease 0.2s both',
    marginBottom: '48px',
  },
  divider: {
    width: '1px',
    height: '48px',
    background: 'linear-gradient(to bottom, transparent, rgba(0,212,255,0.5), transparent)',
    margin: '0 auto 48px',
    animation: 'fadeUp 0.9s ease 0.3s both',
  },

  /* ── INPUT SECTION ── */
  inputWrap: {
    maxWidth: '760px',
    margin: '0 auto',
    padding: '0 24px 64px',
    animation: 'fadeUp 1s ease 0.4s both',
  },
  inputCard: {
    background: 'rgba(13, 18, 25, 0.8)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '28px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  label: {
    display: 'block',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#00d4ff',
    marginBottom: '10px',
  },
  textarea: {
    width: '100%',
    padding: '16px',
    fontSize: '15px',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    background: 'rgba(6,10,15,0.8)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    color: '#e8edf5',
    resize: 'vertical',
    lineHeight: 1.7,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
    marginBottom: '16px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    background: 'rgba(6,10,15,0.8)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    color: '#e8edf5',
    outline: 'none',
  },
  select: {
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    background: 'rgba(6,10,15,0.8)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    color: '#e8edf5',
    outline: 'none',
    cursor: 'pointer',
  },
  btnPrimary: {
    width: '100%',
    padding: '16px',
    fontFamily: "'Orbitron', monospace",
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #00d4ff, #0066ff)',
    color: '#000',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.15s',
    position: 'relative',
    overflow: 'hidden',
  },
  btnDisabled: {
    background: 'rgba(255,255,255,0.05)',
    color: '#3a4a5c',
    cursor: 'not-allowed',
  },

  /* ── PIPELINE SECTION ── */
  pipelineWrap: {
    maxWidth: '1060px',
    margin: '0 auto',
    padding: '0 24px 40px',
  },
  sectionLabel: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#3a4a5c',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  sectionLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(255,255,255,0.05)',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '28px',
  },

  /* ── STATUS BAR ── */
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    marginBottom: '20px',
    borderRadius: '10px',
    background: 'rgba(0,212,255,0.04)',
    border: '1px solid rgba(0,212,255,0.12)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    color: '#00d4ff',
  },
  statusDot: {
    width: '8px', height: '8px',
    borderRadius: '50%',
    background: '#00d4ff',
    flexShrink: 0,
    animation: 'pulse-ring 1.5s infinite',
  },
  statusDotDone: {
    background: '#00e87a',
    animation: 'none',
  },
  statusDotError: {
    background: '#ff4444',
    animation: 'blink 1s infinite',
  },

  /* ── APPROVAL PANEL ── */
  approvalCard: {
    padding: '28px',
    marginBottom: '20px',
    borderRadius: '16px',
    background: 'rgba(13,18,25,0.9)',
    border: '1px solid rgba(0,212,255,0.2)',
    backdropFilter: 'blur(12px)',
    animation: 'fadeUp 0.5s ease both',
  },
  approvalTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#ffffff',
    marginBottom: '6px',
  },
  approvalSub: {
    fontSize: '13px',
    color: '#5a6a80',
    marginBottom: '18px',
    lineHeight: 1.6,
  },
  planBox: {
    background: 'rgba(6,10,15,0.9)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '8px',
    padding: '16px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    color: '#5a6a80',
    lineHeight: 1.8,
    maxHeight: '220px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    marginBottom: '18px',
  },
  feedbackTextarea: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 300,
    background: 'rgba(6,10,15,0.8)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    color: '#e8edf5',
    resize: 'vertical',
    lineHeight: 1.7,
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: '14px',
  },
  btnRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  btnApprove: {
    padding: '11px 24px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 600,
    background: '#00e87a',
    color: '#001a0d',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'opacity 0.15s',
  },
  btnChanges: {
    padding: '11px 24px',
    fontSize: '14px',
    fontWeight: 500,
    background: 'none',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.4)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.15s',
  },
  btnSubmitFeedback: {
    padding: '11px 24px',
    fontSize: '14px',
    fontWeight: 600,
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.4)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  btnCancel: {
    padding: '11px 24px',
    fontSize: '14px',
    background: 'none',
    color: '#3a4a5c',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },

  /* ── COMPLETE BANNER ── */
  completeBanner: {
    padding: '24px 28px',
    marginBottom: '24px',
    borderRadius: '16px',
    background: 'rgba(0,232,122,0.04)',
    border: '1px solid rgba(0,232,122,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    animation: 'fadeUp 0.5s ease both',
  },
  completeTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '16px',
    fontWeight: 700,
    color: '#00e87a',
    marginBottom: '6px',
    letterSpacing: '0.08em',
  },
  githubLink: {
    color: '#00d4ff',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
    textDecoration: 'none',
  },
  btnNew: {
    padding: '12px 24px',
    fontFamily: "'Orbitron', monospace",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    background: 'none',
    color: '#00e87a',
    border: '1px solid rgba(0,232,122,0.4)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  /* ── ERROR ── */
  errorBar: {
    padding: '14px 18px',
    marginBottom: '16px',
    borderRadius: '10px',
    background: 'rgba(255,68,68,0.06)',
    border: '1px solid rgba(255,68,68,0.25)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    color: '#ff6666',
  },

  /* ── FOOTER ── */
  footer: {
    textAlign: 'center',
    padding: '40px 24px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    color: '#1e2a38',
    letterSpacing: '0.1em',
  },
};

/* ─── AGENT CARD COMPONENT ───────────────────────────────────────────────── */
// Overrides the imported AgentCard with our own Tesla-style card
function DevronAgentCard({ agent, isActive }) {
  const statusMap = {
    idle:    { color: '#1e2a38', label: 'Standby',   glyph: '—' },
    running: { color: '#00d4ff', label: 'Active',    glyph: '●' },
    done:    { color: '#00e87a', label: 'Complete',  glyph: '✓' },
    error:   { color: '#ff4444', label: 'Error',     glyph: '✕' },
  };
  const s = statusMap[agent.status] || statusMap.idle;

  return (
    <div style={{
      padding: '20px',
      background: isActive
        ? 'rgba(0,212,255,0.04)'
        : 'rgba(13,18,25,0.6)',
      border: `1px solid ${isActive ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '14px',
      transition: 'all 0.3s',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Active scan-line effect */}
      {isActive && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(0,212,255,0.04) 50%, transparent 60%)',
          animation: 'scanline 2s linear infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Top row: icon + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '20px', lineHeight: 1 }}>{agent.icon}</span>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.12em', color: '#e8edf5',
          flex: 1,
        }}>
          {agent.name.toUpperCase()}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px', color: s.color,
          display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: s.color, flexShrink: 0,
            animation: isActive ? 'pulse-ring 1.5s infinite' : 'none',
          }} />
          {s.label}
        </span>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '12px', color: '#3a4a5c',
        lineHeight: 1.6, fontWeight: 300,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {agent.description}
      </p>

      {/* Output preview */}
      {agent.status === 'done' && agent.output && (
        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: '#2a3a4a',
          lineHeight: 1.6,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {agent.output.substring(0, 100)}…
        </div>
      )}
    </div>
  );
}

/* ─── MAIN APP ────────────────────────────────────────────────────────────── */
export default function App() {

  /* State */
  const [prompt, setPrompt]           = useState('');
  const [projectType, setProjectType] = useState('python');
  const [projectName, setProjectName] = useState('');
  const [sessionId, setSessionId]     = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [isStarting, setIsStarting]   = useState(false);
  const [activeTab, setActiveTab]     = useState('architecture');
  const [feedback, setFeedback]       = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [error, setError]             = useState('');
  const [agents, setAgents] = useState({
    architect: { name: 'Architect', icon: '🏗', description: 'Designs system architecture and technical blueprint.',       status: 'idle', output: '' },
    developer: { name: 'Developer', icon: '💻', description: 'Writes production-grade code from the architecture plan.',    status: 'idle', output: '' },
    tester:    { name: 'Tester',    icon: '🧪', description: 'Validates code quality, logic, and edge cases.',             status: 'idle', output: '' },
    github:    { name: 'GitHub',    icon: '🐙', description: 'Commits and deploys the final code to the repository.',      status: 'idle', output: '' },
  });
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting]         = useState(false);

  const outputRef = useRef(null);

  /* Auto-scroll */
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [pipelineStatus?.outputs]);

  /* Polling loop */
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`${API_URL}/project/${sessionId}/status`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        setPipelineStatus(data);

        const activeAgent  = STATUS_TO_AGENT[data.status] || null;
        const doneAgents   = STATUS_DONE_AGENTS[data.status] || [];

        setAgents(prev => {
          const next = {};
          for (const key of Object.keys(prev)) {
            const agentStatus =
              key === activeAgent     ? 'running'
              : doneAgents.includes(key) ? 'done'
              : 'idle';
            next[key] = {
              ...prev[key],
              status: agentStatus,
              output: data.outputs?.[
                key === 'architect' ? 'architecture'
                : key === 'tester'  ? 'tests'
                : key
              ] || prev[key].output,
            };
          }
          return next;
        });

        if (['developing','implementing'].includes(data.status))  setActiveTab('code');
        if (['testing','validating'].includes(data.status))       setActiveTab('tests');
        if (['planning','waiting_plan_approval','processing_feedback','waiting_improvement_approval'].includes(data.status)) setActiveTab('architecture');

        if (data.is_done) clearInterval(interval);
      } catch (e) {
        setError(`Connection error: ${e.message}`);
        clearInterval(interval);
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [sessionId]);

  /* Start pipeline */
  async function handleStart() {
    if (!prompt.trim() || isStarting) return;
    setIsStarting(true);
    setError('');
    setPipelineStatus(null);
    setSessionId(null);
    setActiveTab('architecture');
    setShowFeedback(false);
    setFeedback('');
    setAgents(prev => {
      const r = {};
      for (const k of Object.keys(prev)) r[k] = { ...prev[k], status: 'idle', output: '' };
      return r;
    });
    try {
      const res = await fetch(`${API_URL}/project/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_description: prompt.trim(),
          project_type: projectType,
          project_name: projectName.trim() || 'devron-project',
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.status); }
      const data = await res.json();
      setSessionId(data.session_id);
    } catch (e) {
      setError(`Failed to start: ${e.message}`);
    } finally {
      setIsStarting(false);
    }
  }

  /* Send response to paused pipeline */
  async function sendResponse(approved, cancelled = false) {
    if (!sessionId) return;
    if (!approved && !cancelled && !feedback.trim()) {
      setError('Please write your feedback before submitting.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/project/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, cancelled, feedback: feedback.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || res.status); }
      setFeedback('');
      setShowFeedback(false);
      setError('');
    } catch (e) {
      setError(`Response error: ${e.message}`);
    }
  }

  /* Reset */
  function handleReset() {
    setSessionId(null); setPipelineStatus(null);
    setPrompt(''); setProjectName(''); setFeedback('');
    setShowFeedback(false); setError(''); setIsStarting(false);
    setActiveTab('architecture');
    setAgents(prev => {
      const r = {};
      for (const k of Object.keys(prev)) r[k] = { ...prev[k], status: 'idle', output: '' };
      return r;
    });
  }

  async function handleExecute() {
    setIsExecuting(true);
    setExecutionResult(null);
    setError('');
    try {
      const res = await fetch(`${API_URL}/project/${sessionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || `Execution failed: ${res.status}`);
      }
      setExecutionResult(await res.json());
    } catch (e) {
      setError(`Execution error: ${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  }

  /* Derived */
  const isWaiting  = pipelineStatus && WAITING.has(pipelineStatus.status);
  const isRunning  = pipelineStatus && !pipelineStatus.is_done;
  const isDone     = pipelineStatus?.status === 'complete';
  const isError    = pipelineStatus?.status === 'error';
  const phaseLabel = pipelineStatus?.phase_label || '';
  const phaseDetail= pipelineStatus?.phase_detail || '';
  const currentPlan= pipelineStatus?.current_plan || '';
  const githubUrl  = pipelineStatus?.github_url || '';
  const outputs    = pipelineStatus?.outputs || { architecture: '', code: '', tests: '' };

  const approvalTitles = {
    waiting_plan_approval:        'TECHNICAL PLAN REVIEW',
    waiting_review:               'PROJECT REVIEW',
    waiting_improvement_approval: 'IMPROVEMENT PLAN REVIEW',
  };
  const approvalTitle = approvalTitles[pipelineStatus?.status] || 'REVIEW REQUIRED';

  /* ── RENDER ── */
  return (
    <div style={S.page}>

      {/* ── HERO ── */}
      <div style={S.hero}>
        <div style={S.heroGlow} />
        <span style={S.wordmark}>DEVRON</span>
        <p style={S.tagline}>Multi-Agent AI Software Development</p>
        <div style={S.divider} />
      </div>

      {/* ── INPUT (only before session starts) ── */}
      {!sessionId && (
        <div style={S.inputWrap}>
          <div style={S.inputCard}>
            <label htmlFor="project-prompt" style={S.label}>
            </label>
            <textarea
              id="project-prompt"
              name="project-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={isStarting}
              placeholder="Describe the software you want to build — be as specific as possible about features, tech stack, and goals."
              rows={5}
              style={{
                ...S.textarea,
                borderColor: prompt ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.07)',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.3)'}
              onBlur={e => e.target.style.borderColor = prompt ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.07)'}
            />

            <div style={S.row}>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="Project name (e.g. my-api)"
                style={S.input}
              />
              <select
                value={projectType}
                onChange={e => setProjectType(e.target.value)}
                style={S.select}
              >
                <option value="python">Python</option>
                <option value="web">Web</option>
                <option value="javascript">JavaScript</option>
                <option value="ml">Machine Learning</option>
              </select>
            </div>

            <button
              onClick={handleStart}
              disabled={!prompt.trim() || isStarting}
              style={{
                ...S.btnPrimary,
                ...(!prompt.trim() || isStarting ? S.btnDisabled : {}),
              }}
            >
              {isStarting
                ? '↻ INITIALIZING AGENTS…'
                : '▶  LAUNCH DEVRON'}
            </button>
          </div>
        </div>
      )}

      {/* ── PIPELINE ── */}
      {(sessionId || Object.values(agents).some(a => a.status !== 'idle')) && (
        <div style={S.pipelineWrap}>

          {/* Section heading */}
          <div style={S.sectionLabel}>
            <span>Agent Pipeline</span>
            <div style={S.sectionLine} />
          </div>

          {/* Agent cards */}
          <div style={S.agentGrid}>
            {Object.entries(agents).map(([key, agent]) => (
              <DevronAgentCard
                key={key}
                agent={agent}
                isActive={agent.status === 'running'}
              />
            ))}
          </div>
          {/* ── FILES SAVED TO DATABASE ── */}
          {pipelineStatus?.files_generated?.length > 0 && (
            <div style={{
              padding: '16px 20px',
              marginBottom: '20px',
              borderRadius: '10px',
              background: 'rgba(13,18,25,0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px', letterSpacing: '0.15em',
                color: '#3a4a5c', textTransform: 'uppercase',
                marginBottom: '10px',
              }}>
                Files saved — {pipelineStatus.files_generated.length} total
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {pipelineStatus.files_generated.map(file => (
                  <span key={file} style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px', color: '#00d4ff',
                    background: 'rgba(0,212,255,0.06)',
                    border: '1px solid rgba(0,212,255,0.15)',
                    padding: '3px 10px', borderRadius: '4px',
                  }}>
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Status bar */}
          {phaseLabel && (
            <div style={S.statusBar}>
              <div style={{
                ...S.statusDot,
                ...(isDone  ? S.statusDotDone  : {}),
                ...(isError ? S.statusDotError : {}),
              }} />
              <span>{phaseLabel}</span>
              {phaseDetail && (
                <span style={{ color: '#3a4a5c', marginLeft: '8px', fontSize: '12px' }}>
                  {phaseDetail}
                </span>
              )}
              {isRunning && (
                <div style={{
                  marginLeft: 'auto', width: '14px', height: '14px',
                  border: '2px solid rgba(0,212,255,0.15)',
                  borderTopColor: '#00d4ff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }} />
              )}
            </div>
          )}

          {/* Error */}
          {(error || isError) && (
            <div style={S.errorBar}>
              ✕ {error || pipelineStatus?.error || 'An error occurred.'}
            </div>
          )}

          {/* ── APPROVAL PANEL ── */}
          {isWaiting && (
            <div style={S.approvalCard}>
              <p style={S.approvalTitle}>{approvalTitle}</p>
              <p style={S.approvalSub}>
                {pipelineStatus?.status === 'waiting_review'
                  ? 'The project has been deployed. Review the output, then approve or request changes.'
                  : 'Review the plan below, then approve to proceed or request modifications.'}
              </p>
              {/* E2B execution results — shown during waiting_review so user can make informed decisions */}
              {pipelineStatus?.status === 'waiting_review' && pipelineStatus?.execution_result && (
                <div style={{
                  marginBottom: '18px',
                  borderRadius: '10px',
                  border: `1px solid ${pipelineStatus.execution_result.success
                    ? 'rgba(0,232,122,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '14px 18px',
                    background: pipelineStatus.execution_result.success
                      ? 'rgba(0,232,122,0.04)' : 'rgba(245,158,11,0.04)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <p style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.1em',
                      color: pipelineStatus.execution_result.success ? '#00e87a' : '#f59e0b',
                      marginBottom: '8px',
                    }}>
                      {pipelineStatus.execution_result.success
                        ? '✓ CODE TESTED SUCCESSFULLY'
                        : '⚠ CODE TESTED WITH WARNINGS'}
                    </p>
                    <p style={{
                      fontSize: '14px', lineHeight: 1.7,
                      color: '#8b90a8',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 300,
                    }}>
                      {pipelineStatus.execution_result.summary}
                    </p>
                  </div>
                  {pipelineStatus.execution_result.output && (
                    <details style={{ background: 'rgba(6,10,15,0.8)' }}>
                      <summary style={{
                        padding: '10px 18px', cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px', color: '#3a4a5c',
                        listStyle: 'none', userSelect: 'none',
                      }}>
                        ▸ View program output
                      </summary>
                      <pre style={{
                        padding: '12px 18px', margin: 0,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px', color: '#00e87a',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {pipelineStatus.execution_result.output}
                      </pre>
                    </details>
                  )}
                </div>
              )}


              {/* Plan preview */}
              {currentPlan && (
                <div style={S.planBox}>{currentPlan}</div>
              )}

              {/* GitHub link */}
              {githubUrl && pipelineStatus?.status === 'waiting_review' && (
                <p style={{ marginBottom: '16px', fontSize: '13px' }}>
                  <span style={{ color: '#3a4a5c', fontFamily: "'JetBrains Mono', monospace" }}>
                    repository →{' '}
                  </span>
                  <a href={githubUrl} target="_blank" rel="noreferrer" style={S.githubLink}>
                    {githubUrl}
                  </a>
                </p>
              )}

              {/* Feedback textarea */}
              {showFeedback && (
                <textarea
                  id="feedback-input"
                  name="feedback-input"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Describe the changes you want — be specific about features, bugs, or improvements…"
                  rows={4}
                  style={S.feedbackTextarea}
                />
              )}

              {/* Buttons */}
              <div style={S.btnRow}>
                <button onClick={() => sendResponse(true)}   style={S.btnApprove}>
                  ✓ Approve
                </button>

                {!showFeedback ? (
                  <button onClick={() => setShowFeedback(true)} style={S.btnChanges}>
                    ✏ Request Changes
                  </button>
                ) : (
                  <button
                    onClick={() => sendResponse(false)}
                    disabled={!feedback.trim()}
                    style={{
                      ...S.btnSubmitFeedback,
                      opacity: feedback.trim() ? 1 : 0.4,
                      cursor: feedback.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ↑ Submit Feedback
                  </button>
                )}

                <button onClick={() => sendResponse(false, true)} style={S.btnCancel}>
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── COMPLETE BANNER ── */}
          {isDone && (
            <div style={S.completeBanner}>
              <div>
                <p style={S.completeTitle}>MISSION COMPLETE</p>
                {githubUrl && (
                  <a href={githubUrl} target="_blank" rel="noreferrer" style={S.githubLink}>
                    {githubUrl} →
                  </a>
                )}
              </div>
              <button onClick={handleReset} style={S.btnNew}>
                + NEW PROJECT
              </button>
            </div>
          )}

          {/* ── OUTPUT PANEL ── */}
          <div style={{ marginTop: '8px' }}>
            <div style={S.sectionLabel}>
              <span>Output</span>
              <div style={S.sectionLine} />
            </div>
            <div ref={outputRef}>
              <OutputPanel
                outputs={{
                  architecture: outputs.architecture || currentPlan,
                  code:         outputs.code,
                  tests:        outputs.tests,
                }}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            </div>
          </div>
          {/* ── RUN & TEST (only shown when complete) ── */}
          {isDone && (
            <div style={{ marginTop: '20px' }}>

              <div style={S.sectionLabel}>
                <span>Execution</span>
                <div style={S.sectionLine} />
              </div>

              {/* Run button */}
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                style={{
                  padding: '13px 28px',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '11px', fontWeight: 700,
                  letterSpacing: '0.15em',
                  background: isExecuting
                    ? 'rgba(255,255,255,0.04)'
                    : 'linear-gradient(135deg, #00e87a, #00a854)',
                  color: isExecuting ? '#3a4a5c' : '#001a0d',
                  border: 'none', borderRadius: '8px',
                  cursor: isExecuting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '16px',
                }}
              >
                {isExecuting ? (
                  <>
                    <div style={{
                      width: '12px', height: '12px',
                      border: '2px solid rgba(255,255,255,0.1)',
                      borderTopColor: '#00d4ff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      flexShrink: 0,
                    }} />
                    RUNNING IN SANDBOX…
                  </>
                ) : '▶  RUN & TEST CODE'}
              </button>

              {/* Results */}
              {executionResult && (
                <div style={{
                  borderRadius: '14px',
                  border: `1px solid ${executionResult.success
                    ? 'rgba(0,232,122,0.2)'
                    : 'rgba(245,158,11,0.2)'}`,
                  overflow: 'hidden',
                }}>

                  {/* Plain English summary — what non-technical users read */}
                  <div style={{
                    padding: '20px 24px',
                    background: executionResult.success
                      ? 'rgba(0,232,122,0.04)'
                      : 'rgba(245,158,11,0.04)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <p style={{
                      fontFamily: "'Orbitron', monospace",
                      fontSize: '11px', fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: executionResult.success ? '#00e87a' : '#f59e0b',
                      marginBottom: '10px',
                    }}>
                      {executionResult.success
                        ? 'EXECUTION SUCCESSFUL'
                        : 'COMPLETED WITH WARNINGS'}
                    </p>
                    <p style={{
                      fontSize: '15px', lineHeight: 1.8,
                      color: '#8b90a8',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 300,
                    }}>
                      {executionResult.summary}
                    </p>
                  </div>

                  {/* Technical output — hidden by default, click to expand */}
                  {(executionResult.output || executionResult.error || executionResult.test_results) && (
                    <details style={{ background: 'rgba(6,10,15,0.8)' }}>
                      <summary style={{
                        padding: '12px 24px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '12px', color: '#3a4a5c',
                        cursor: 'pointer', userSelect: 'none',
                        listStyle: 'none',
                      }}>
                        ▸ Technical output (click to expand)
                      </summary>

                      <div style={{ padding: '0 24px 20px' }}>

                        {executionResult.output && (
                          <>
                            <p style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px', color: '#3a4a5c',
                              textTransform: 'uppercase',
                              margin: '16px 0 8px',
                            }}>
                              Program Output
                            </p>
                            <pre style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '12px', lineHeight: 1.8,
                              color: '#00e87a',
                              background: 'rgba(0,0,0,0.3)',
                              padding: '14px 16px', borderRadius: '8px',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              margin: 0,
                              border: '1px solid rgba(0,232,122,0.1)',
                            }}>
                              {executionResult.output}
                            </pre>
                          </>
                        )}

                        {executionResult.error && (
                          <>
                            <p style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px', color: '#3a4a5c',
                              textTransform: 'uppercase',
                              margin: '16px 0 8px',
                            }}>
                              Errors
                            </p>
                            <pre style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '12px', lineHeight: 1.8,
                              color: '#f87171',
                              background: 'rgba(0,0,0,0.3)',
                              padding: '14px 16px', borderRadius: '8px',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              margin: 0,
                              border: '1px solid rgba(255,68,68,0.1)',
                            }}>
                              {executionResult.error}
                            </pre>
                          </>
                        )}

                        {executionResult.test_results && (
                          <>
                            <p style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '11px', color: '#3a4a5c',
                              textTransform: 'uppercase',
                              margin: '16px 0 8px',
                            }}>
                              Test Report
                            </p>
                            <pre style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '12px', lineHeight: 1.8,
                              color: '#5db8ff',
                              background: 'rgba(0,0,0,0.3)',
                              padding: '14px 16px', borderRadius: '8px',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                              margin: 0,
                              border: '1px solid rgba(0,212,255,0.1)',
                            }}>
                              {executionResult.test_results}
                            </pre>
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Cancel while running */}
          {isRunning && !isWaiting && (
            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button onClick={handleReset} style={S.btnCancel}>
                ✕ Abort & Start Over
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={S.footer}>
        DEVRON | MULTI-AGENT AI SYSTEM
      </div>
      
      {/* ── ANALYTICS ── */}
      <Analytics />
    </div>
  );
}