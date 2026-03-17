import { useState, useEffect, useRef } from 'react';
import AgentCard from './components/AgentCard';
import OutputPanel from './components/OutputPanel';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL;
const POLL_INTERVAL_MS = 2000; // poll every 2 seconds

// Maps the backend's status string → which agent card should be "active" (highlighted)
// Your backend sends statuses like "planning", "developing", "testing" etc.
// We translate those into the agent key names used in the cards.
const STATUS_TO_AGENT = {
  creating_repo:               'github',
  planning:                    'architect',
  waiting_plan_approval:       'architect',
  developing:                  'developer',
  testing:                     'tester',
  deploying:                   'github',
  waiting_review:              null,
  processing_feedback:         'architect',
  waiting_improvement_approval:'architect',
  implementing:                'developer',
  validating:                  'tester',
  deploying_changes:           'github',
  complete:                    null,
  error:                       null,
};

// Maps backend status → which agent cards should show "done" (green checkmark)
// Once a phase passes, the card should stay green — not go back to idle.
const STATUS_COMPLETED_AGENTS = {
  developing:                  ['architect'],
  testing:                     ['architect', 'developer'],
  deploying:                   ['architect', 'developer', 'tester'],
  waiting_review:              ['architect', 'developer', 'tester', 'github'],
  processing_feedback:         ['architect', 'developer', 'tester', 'github'],
  waiting_improvement_approval:['architect', 'developer', 'tester', 'github'],
  implementing:                ['architect'],
  validating:                  ['architect', 'developer'],
  deploying_changes:           ['architect', 'developer', 'tester'],
  complete:                    ['architect', 'developer', 'tester', 'github'],
};

// The three statuses where the backend is PAUSED waiting for the user to respond
const WAITING_STATUSES = new Set([
  'waiting_plan_approval',
  'waiting_review',
  'waiting_improvement_approval',
]);

export default function App() {

  // ─── STATE ──────────────────────────────────────────────────────────────────

  // User's project details
  const [prompt, setPrompt]           = useState('');
  const [projectType, setProjectType] = useState('python');
  const [projectName, setProjectName] = useState('');

  // Session ID returned by POST /project/start
  // Once set, the polling loop starts automatically (via useEffect below)
  const [sessionId, setSessionId]     = useState(null);

  // The full status object from GET /project/{id}/status
  // This is the single source of truth — all UI derives from this.
  const [pipelineStatus, setPipelineStatus] = useState(null);

  // UI state
  const [isStarting, setIsStarting]   = useState(false); // button spinner while calling /start
  const [activeTab, setActiveTab]     = useState('architecture');
  const [feedback, setFeedback]       = useState('');    // text for "request changes" textarea
  const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [error, setError]             = useState('');

  // Agent card display state — derived from pipelineStatus in the polling effect
  const [agents, setAgents] = useState({
    architect: { name: 'Architect', icon: '🏗', description: 'Analyzes your idea and designs the system architecture.', status: 'idle', output: '' },
    developer: { name: 'Developer', icon: '💻', description: 'Writes the actual code based on the architecture.',        status: 'idle', output: '' },
    tester:    { name: 'Tester',    icon: '🧪', description: 'Reviews code for bugs and quality issues.',                status: 'idle', output: '' },
    github:    { name: 'GitHub',    icon: '🐙', description: 'Commits the approved code to the repository.',             status: 'idle', output: '' },
  });

  const outputRef = useRef(null);

  // ─── AUTO-SCROLL when outputs change ────────────────────────────────────────
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [pipelineStatus?.outputs]);

  // ─── POLLING LOOP ────────────────────────────────────────────────────────────
  // This useEffect runs whenever sessionId changes.
  // When sessionId becomes non-null, it starts an interval that calls
  // GET /project/{id}/status every 2 seconds and updates all state.
  // When the pipeline is done (is_done=true), the interval clears itself.
  useEffect(() => {
    if (!sessionId) return; // No session yet — do nothing

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/project/${sessionId}/status`);
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
        const data = await res.json();

        setPipelineStatus(data);

        // ── Update agent card statuses based on pipeline status ──────────────
        // "active" = currently running (blue highlight)
        // "done"   = already completed (green checkmark)
        // "idle"   = not started yet
        const activeAgent    = STATUS_TO_AGENT[data.status] || null;
        const completedAgents = STATUS_COMPLETED_AGENTS[data.status] || [];

        setAgents(prev => {
          const updated = {};
          for (const key of Object.keys(prev)) {
            let status = 'idle';
            if (key === activeAgent)         status = 'running';
            else if (completedAgents.includes(key)) status = 'done';

            // Keep output text if it was already set
            updated[key] = {
              ...prev[key],
              status,
              output: data.outputs?.[key === 'architect' ? 'architecture'
                                   : key === 'tester'    ? 'tests'
                                   : key]                || prev[key].output,
            };
          }
          return updated;
        });

        // ── Auto-switch output tab based on phase ─────────────────────────────
        if (data.status === 'developing' || data.status === 'implementing') {
          setActiveTab('code');
        } else if (data.status === 'testing' || data.status === 'validating') {
          setActiveTab('tests');
        } else if (data.status === 'planning' || data.status === 'waiting_plan_approval') {
          setActiveTab('architecture');
        } else if (data.status === 'processing_feedback' || data.status === 'waiting_improvement_approval') {
          setActiveTab('architecture');
        }

        // ── Stop polling when done ────────────────────────────────────────────
        if (data.is_done) {
          clearInterval(interval);
        }

      } catch (err) {
        setError(`Polling error: ${err.message}`);
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    // Cleanup: clear interval if this component unmounts or sessionId changes
    return () => clearInterval(interval);
  }, [sessionId]);

  // ─── START THE PIPELINE ───────────────────────────────────────────────────────
  // Called when user clicks "Run Agent Pipeline".
  // Calls POST /project/start and stores the returned session_id.
  async function handleStart() {
    if (!prompt.trim() || isStarting) return;

    setIsStarting(true);
    setError('');
    setFeedback('');
    setShowFeedbackBox(false);
    setPipelineStatus(null);
    setSessionId(null);
    setActiveTab('architecture');

    // Reset all agent cards to idle
    setAgents(prev => {
      const reset = {};
      for (const key of Object.keys(prev)) {
        reset[key] = { ...prev[key], status: 'idle', output: '' };
      }
      return reset;
    });

    try {
      const res = await fetch(`${API_URL}/project/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_description: prompt.trim(),
          project_type: projectType,
          project_name: projectName.trim() || 'my-ai-project',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Server error: ${res.status}`);
      }

      const data = await res.json();
      // Setting sessionId triggers the polling useEffect above
      setSessionId(data.session_id);

    } catch (err) {
      setError(`Failed to start: ${err.message}`);
    } finally {
      setIsStarting(false);
    }
  }

  // ─── SEND A RESPONSE to the waiting pipeline ──────────────────────────────
  // Called for Approve, Request Changes, or Cancel.
  // Calls POST /project/{id}/respond which wakes up the backend thread.
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
        body: JSON.stringify({
          approved,
          cancelled,
          feedback: feedback.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Response failed: ${res.status}`);
      }

      // Clear feedback box after sending
      setFeedback('');
      setShowFeedbackBox(false);
      setError('');

    } catch (err) {
      setError(`Failed to send response: ${err.message}`);
    }
  }

  // ─── RESET everything to start a new project ─────────────────────────────
  function handleReset() {
    setSessionId(null);
    setPipelineStatus(null);
    setPrompt('');
    setProjectName('');
    setFeedback('');
    setShowFeedbackBox(false);
    setError('');
    setIsStarting(false);
    setActiveTab('architecture');
    setAgents(prev => {
      const reset = {};
      for (const key of Object.keys(prev)) {
        reset[key] = { ...prev[key], status: 'idle', output: '' };
      }
      return reset;
    });
  }

  // ─── DERIVED VALUES (computed from pipelineStatus) ────────────────────────
  const isWaiting    = pipelineStatus && WAITING_STATUSES.has(pipelineStatus.status);
  const isRunning    = pipelineStatus && !pipelineStatus.is_done;
  const isDone       = pipelineStatus?.status === 'complete';
  const isError      = pipelineStatus?.status === 'error';
  const phaseLabel   = pipelineStatus?.phase_label || '';
  const phaseDetail  = pipelineStatus?.phase_detail || '';
  const currentPlan  = pipelineStatus?.current_plan || '';
  const githubUrl    = pipelineStatus?.github_url || '';
  const outputs      = pipelineStatus?.outputs || { architecture: '', code: '', tests: '' };

  // What heading to show on the approval panel
  const approvalHeadings = {
    waiting_plan_approval:        '📋 Review the Technical Plan',
    waiting_review:               '🔍 Review the Generated Project',
    waiting_improvement_approval: '📝 Review the Improvement Plan',
  };
  const approvalHeading = approvalHeadings[pipelineStatus?.status] || 'Review Required';

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 20px' }}>

      {/* ── HEADER ── */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>
          Developer AI Agent
        </h1>
        <p style={{ color: '#6b7a99', lineHeight: '1.6' }}>
          Describe what you want to build. Four AI agents will collaborate to
          design, code, test, and commit it to GitHub.
        </p>
      </div>

      {/* ── INPUT FORM — only show when not running ── */}
      {!sessionId && (
        <div style={{ marginBottom: '24px' }}>

          {/* Project description */}
          <textarea
            id="project-prompt"
            name="project-prompt"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={isStarting}
            placeholder="e.g. Build a todo list app with React and localStorage"
            rows={4}
            style={{
              width: '100%', padding: '14px', fontSize: '15px',
              background: '#1a1d27', border: '1px solid #2e3250', borderRadius: '8px',
              color: '#e8eaf0', resize: 'vertical', lineHeight: '1.6',
              fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '10px',
            }}
          />

          {/* Project name and type — row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Project name (e.g. my-todo-app)"
              style={{
                flex: 1, padding: '10px 14px', fontSize: '14px',
                background: '#1a1d27', border: '1px solid #2e3250', borderRadius: '8px',
                color: '#e8eaf0', fontFamily: 'inherit',
              }}
            />
            <select
              value={projectType}
              onChange={e => setProjectType(e.target.value)}
              style={{
                padding: '10px 14px', fontSize: '14px',
                background: '#1a1d27', border: '1px solid #2e3250', borderRadius: '8px',
                color: '#e8eaf0', fontFamily: 'inherit',
              }}
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
              padding: '12px 28px', fontSize: '15px', fontWeight: '600',
              background: !prompt.trim() || isStarting ? '#2e3250' : '#7c6af7',
              color: !prompt.trim() || isStarting ? '#6b7a99' : '#fff',
              border: 'none', borderRadius: '8px',
              cursor: !prompt.trim() || isStarting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isStarting ? '⏳ Starting…' : '▶ Run Agent Pipeline'}
          </button>
        </div>
      )}

      {/* ── AGENT PIPELINE CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        {Object.entries(agents).map(([key, agent]) => (
          <AgentCard
            key={key}
            agent={agent}
            isActive={agent.status === 'running'}
          />
        ))}
      </div>

      {/* ── CURRENT PHASE LABEL (shown while running) ── */}
      {phaseLabel && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
          background: isError ? '#2a1a1a' : '#1a2535',
          border: `1px solid ${isError ? '#f87171' : '#2e3250'}`,
          color: isError ? '#f87171' : '#5db8ff', fontSize: '14px',
        }}>
          {phaseLabel}
          {phaseDetail && (
            <span style={{ color: '#6b7a99', marginLeft: '10px', fontSize: '13px' }}>
              {phaseDetail}
            </span>
          )}
        </div>
      )}

      {/* ── ERROR MESSAGE ── */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px', borderRadius: '8px',
          background: '#2a1a1a', border: '1px solid #f87171',
          color: '#f87171', fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* ── APPROVAL / REVIEW PANEL ──
           This shows whenever the backend is PAUSED waiting for user input.
           isWaiting is true for all three pause points:
             - waiting_plan_approval        (after manager creates plan)
             - waiting_review               (after initial deploy)
             - waiting_improvement_approval (after manager creates improvement plan) */}
      {isWaiting && (
        <div style={{
          padding: '20px', marginBottom: '16px', borderRadius: '10px',
          border: '1px solid #3d3520', background: '#1f1c10',
        }}>
          <p style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>
            {approvalHeading}
          </p>

          {/* Show the plan text if we're reviewing a plan */}
          {currentPlan && (
            <div style={{
              background: '#12151f', border: '1px solid #2e3250',
              borderRadius: '6px', padding: '14px',
              fontFamily: 'monospace', fontSize: '13px',
              color: '#8b90a8', lineHeight: '1.7',
              maxHeight: '250px', overflowY: 'auto',
              marginBottom: '14px', whiteSpace: 'pre-wrap',
            }}>
              {currentPlan}
            </div>
          )}

          {/* GitHub link if available */}
          {githubUrl && pipelineStatus?.status === 'waiting_review' && (
            <p style={{ fontSize: '13px', color: '#6b7a99', marginBottom: '12px' }}>
              🔗 View on GitHub:{' '}
              <a href={githubUrl} target="_blank" rel="noreferrer"
                style={{ color: '#5db8ff' }}>
                {githubUrl}
              </a>
            </p>
          )}

          <p style={{ fontSize: '13px', color: '#8b90a8', marginBottom: '14px' }}>
            Approve to continue, or request changes with specific feedback.
          </p>

          {/* Feedback textarea — shown when user clicks "Request Changes" */}
          {showFeedbackBox && (
            <textarea
              id="feedback-input"
              name="feedback-input"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Describe the changes you want…"
              rows={4}
              style={{
                width: '100%', padding: '12px', fontSize: '14px',
                background: '#12151f', border: '1px solid #2e3250',
                borderRadius: '6px', color: '#e8eaf0',
                fontFamily: 'inherit', lineHeight: '1.6',
                boxSizing: 'border-box', marginBottom: '10px',
                resize: 'vertical',
              }}
            />
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* APPROVE */}
            <button
              onClick={() => sendResponse(true)}
              style={{
                padding: '9px 22px', background: '#4ade80', color: '#0a1a0a',
                border: 'none', borderRadius: '6px', fontWeight: '600',
                cursor: 'pointer', fontSize: '14px',
              }}
            >
              ✓ Approve
            </button>

            {/* REQUEST CHANGES — first click reveals textarea, second click sends */}
            {!showFeedbackBox ? (
              <button
                onClick={() => setShowFeedbackBox(true)}
                style={{
                  padding: '9px 22px', background: 'none', color: '#fbbf24',
                  border: '1px solid #fbbf24', borderRadius: '6px',
                  cursor: 'pointer', fontSize: '14px',
                }}
              >
                ✏️ Request Changes
              </button>
            ) : (
              <button
                onClick={() => sendResponse(false)}
                disabled={!feedback.trim()}
                style={{
                  padding: '9px 22px',
                  background: feedback.trim() ? '#fbbf24' : '#2e3250',
                  color: feedback.trim() ? '#0a0a0a' : '#6b7a99',
                  border: 'none', borderRadius: '6px', fontWeight: '600',
                  cursor: feedback.trim() ? 'pointer' : 'not-allowed', fontSize: '14px',
                }}
              >
                📤 Submit Feedback
              </button>
            )}

            {/* CANCEL */}
            <button
              onClick={() => sendResponse(false, true)}
              style={{
                padding: '9px 22px', background: 'none', color: '#f87171',
                border: '1px solid #f87171', borderRadius: '6px',
                cursor: 'pointer', fontSize: '14px',
              }}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── COMPLETE BANNER ── */}
      {isDone && (
        <div style={{
          padding: '16px 20px', marginBottom: '16px', borderRadius: '10px',
          border: '1px solid #4ade80', background: '#0a1a0a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '10px',
        }}>
          <div>
            <p style={{ fontWeight: '700', color: '#4ade80', marginBottom: '4px' }}>
              🎉 Project Complete!
            </p>
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noreferrer"
                style={{ color: '#5db8ff', fontSize: '14px' }}>
                View on GitHub →
              </a>
            )}
          </div>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 20px', background: '#7c6af7', color: '#fff',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontWeight: '600', fontSize: '14px',
            }}
          >
            + New Project
          </button>
        </div>
      )}

      {/* ── OUTPUT PANEL ── */}
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

      {/* ── "New Project" button while running ── */}
      {isRunning && (
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 16px', background: 'none',
              color: '#6b7a99', border: '1px solid #2e3250',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
            }}
          >
            ✕ Cancel & Start Over
          </button>
        </div>
      )}
    </div>
  );
}