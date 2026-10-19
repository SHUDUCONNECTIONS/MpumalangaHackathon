import { useEffect, useRef, useState } from 'react';
import credits from './credits.json';
import { configured, useAuth, useTable, useSetting, useOnline, supabase } from './backend.js';
import { isSafeUrl, safeHref } from './safe.js';
import { CRITERIA, computeResults, resultsToCsv, formatStamp } from './scoring.js';
import { getChats, challenges, programme, days, faqs, resources } from './data.js';

/* ---------- helpers ---------- */
function useStored(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key, v]);
  // keep multiple tabs/windows in sync (demo stand-in for a real backend)
  useEffect(() => {
    const on = (e) => {
      if (e.key !== key || e.newValue == null) return;
      try { setV(JSON.parse(e.newValue)); } catch { /* ignore */ }
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, [key]);
  return [v, setV];
}

const pad = (n) => String(n).padStart(2, '0');
function useCountdown(deadline) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const isSet = deadline != null;
  const left = isSet ? Math.max(0, Math.floor((deadline - now) / 1000)) : 0;
  return { isSet, h: pad(Math.floor(left / 3600)), m: pad(Math.floor((left % 3600) / 60)), s: pad(left % 60), left };
}

const Icon = ({ d, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const I = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z',
  bell: ['M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 01-3.4 0'],
  user: ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2', 'M12 11a4 4 0 100-8 4 4 0 000 8z'],
  back: 'M15 18l-6-6 6-6',
  search: ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.3-4.3'],
  chevron: 'M9 6l6 6-6 6',
  pin: ['M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z', 'M12 12a2 2 0 100-4 2 2 0 000 4z'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4z'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  cal: ['M4 5h16v16H4z', 'M16 3v4M8 3v4M4 10h16'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
  bulb: ['M9 18h6M10 21h4', 'M12 3a6 6 0 00-4 10.4c.7.7 1 1.4 1 2.6h6c0-1.2.3-1.9 1-2.6A6 6 0 0012 3z'],
  mega: ['M3 11v3l14 5V6z', 'M17 9a3 3 0 010 6'],
  team: ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8z', 'M23 21v-2a4 4 0 00-3-3.9', 'M16 3.1a4 4 0 010 7.8'],
  file: ['M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 3v5h5'],
  help: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3', 'M12 17h.01'],
  gear: ['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'],
  logout: ['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  group: ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 11a4 4 0 100-8 4 4 0 000 8z'],
  trophy: ['M8 21h8M12 17v4', 'M7 4h10v5a5 5 0 01-10 0z', 'M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3'],
  clock: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M12 6v6l4 2'],
};

const Hero = ({ children, className = '' }) => <div className={`hero ${className}`}>{children}</div>;
const Logo = ({ small }) => (
  <div className={`logo ${small ? 'small' : ''}`}>
    <svg viewBox="0 0 48 32" width={small ? 34 : 44}>
      <circle cx="24" cy="16" r="9" fill="#f5a623" />
      <path d="M2 24c8-8 14-8 22-2s16 4 22-4v10H2z" fill="#1fa463" />
    </svg>
    <div><b>Mpumalanga</b><i>— TOURISM —</i></div>
  </div>
);

/* ---------- screens ---------- */
function Home({ go, deadline, unread }) {
  const t = useCountdown(deadline);
  const tiles = [
    ['Team Chat', 'Talk to your team', 'chat', 'chat', '#22b573'],
    ['Announcements', 'Official updates', 'alerts', 'mega', '#f5a623'],
    ['Challenges', 'Choose a problem', 'challenges', 'bulb', '#7c5cff'],
    ['Programme', 'Sessions & deadlines', 'programme', 'cal', '#17b8a6'],
    ['Mentors & Judges', 'Get support', 'chat:mentors', 'team', '#eb4d6b'],
    ['Submit Project', 'Upload your solution', 'submit', 'upload', '#2f80ed'],
  ];
  return (
    <div className="screen">
      <Hero className="tall">
        <div className="row between">
          <Logo />
          <button className="bell" aria-label="Announcements" onClick={() => go('alerts')}><Icon d={I.bell} />{unread > 0 && <em>{unread}</em>}</button>
        </div>
        <h1 className="homeTitle">Tourism Mpumalanga<br />Hackathon Hub</h1>
        <p className="tag">Innovate • Collaborate • Transform Tourism</p>
      </Hero>
      <div className="pull">
        <button className="timerCard" onClick={() => go('timer')}>
          <span>{t.isSet ? 'Time remaining until code freeze' : 'Code freeze time not set yet'}</span>
          <div className="digits">
            <div><b>{t.h}</b><small>Hours</small></div><i>:</i>
            <div><b>{t.m}</b><small>Minutes</small></div><i>:</i>
            <div><b>{t.s}</b><small>Seconds</small></div>
          </div>
        </button>
        <div className="grid3">
          {tiles.map(([title, sub, to, ic, c]) => (
            <button key={title} className="tile" onClick={() => go(to)}>
              <span className="tileIcon" style={{ background: c + '22', color: c, borderColor: c }}><Icon d={I[ic]} /></span>
              <b>{title}</b><small>{sub}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const img = (n) => `/images/${n}.jpg`;
function Header({ title, onBack, right, photo }) {
  return (
    <div className={`header ${photo ? 'photo' : ''}`} style={photo ? { '--bg': `url(${img(photo)})` } : undefined}>
      {onBack && <button onClick={onBack} aria-label="Back"><Icon d={I.back} /></button>}
      <h2>{title}</h2>
      <div className="grow" />
      {right}
    </div>
  );
}

function ChatList({ openChat, back, messages, user, initialTab, unreadBy }) {
  const [tab, setTab] = useState(initialTab || 'all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const tabs = [['all', 'All Chats'], ['team', 'My Team'], ['mentors', 'Mentors']];
  const list = getChats(user).filter((c) => (tab === 'all' || c.tab === tab) && c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="screen">
      <Header photo="p1" title="Team Chat" onBack={back} right={<button aria-label="Search chats" onClick={() => setSearching(!searching)}><Icon d={I.search} /></button>} />
      <div className="sheet">
        {searching && <input className="search" autoFocus placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="tabs line">{tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        {list.map((c) => {
          const last = (messages[c.id] || []).slice(-1)[0];
          return (
            <button key={c.id} className="chatRow" onClick={() => openChat(c.id)}>
              <span className="avatar photo" style={{ backgroundImage: `url(${img(c.photo)})` }} />
              <div className="grow"><b>{c.name}</b><small>{last ? last.text : 'No messages yet'}</small></div>
              <div className="meta"><small>{last?.time}</small>{unreadBy[c.id] > 0 && <em className="badge">{unreadBy[c.id]}</em>}</div>
            </button>
          );
        })}
        <button className="fab" aria-label="New message" onClick={() => openChat('general')}><Icon d={I.edit} /></button>
      </div>
    </div>
  );
}

function ChatRoom({ id, back, messages, send, user, delMsg, pending }) {
  const c = getChats(user).find((x) => x.id === id);
  const [text, setText] = useState('');
  const msgs = messages[id] || [];
  const submit = (e) => { e.preventDefault(); if (text.trim()) { send(id, text.trim()); setText(''); } };
  return (
    <div className="screen">
      <Header photo={c.photo} title={c.name} onBack={back} />
      <div className="sheet room">
        <div className="msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.from === user.name ? 'me' : ''}`}>
              {m.from !== user.name && <small className="who">{m.from}</small>}
              <p>{m.text}</p><small>{m.time}</small>
              {user.role === 'Organiser' && <button className="msgDel" aria-label="Delete message" onClick={() => delMsg(m.id)}>✕</button>}
            </div>
          ))}
          {pending.map((m, i) => (
            <div key={`p${i}`} className="msg me pending"><p>{m.text}</p><small>⏳ waiting for connection…</small></div>
          ))}
        </div>
        <form className="composer" onSubmit={submit}>
          <input aria-label="Message" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} />
          <button aria-label="Send message"><Icon d={I.send} /></button>
        </form>
      </div>
    </div>
  );
}

function Announcements({ back, anns, postAnn, delAnn, isOrganiser }) {
  const [f, setF] = useState('All');
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ tag: 'General', title: '', body: '' });
  const list = anns.filter((a) => f === 'All' || a.tag === f);
  const post = (e) => {
    e.preventDefault();
    postAnn(draft);
    setDraft({ tag: 'General', title: '', body: '' });
    setComposing(false);
  };
  return (
    <div className="screen">
      <Header photo="p10" title="Announcements" onBack={back} right={isOrganiser && <button onClick={() => setComposing(!composing)}><Icon d={I.edit} /></button>} />
      <div className="sheet">
        {composing && (
          <form className="form compose" onSubmit={post}>
            <select value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}>
              {['General', 'Important', 'Schedule'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input required placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <textarea required rows={3} placeholder="Message to all hackers" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <button className="btn small">Post announcement</button>
          </form>
        )}
        <div className="tabs pills">{['All', 'Important', 'Schedule', 'General'].map((x) => <button key={x} aria-pressed={f === x} className={f === x ? 'on' : ''} onClick={() => setF(x)}>{x}</button>)}</div>
        {list.length === 0 && <p className="empty">No announcements yet.</p>}
        {list.map((a) => (
          <div key={a.id} className={`ann ${a.urgent ? 'urgent' : ''}`}>
            <span className={`annIcon ${a.tag}`}><Icon d={a.tag === 'Schedule' ? I.cal : a.tag === 'General' ? I.help : I.mega} /></span>
            <div className="grow">
              <span className={`chip ${a.tag}`}>{a.tag}</span>
              <b>{a.title}</b><p>{a.body}</p><small>{a.time}</small>
            </div>
            {isOrganiser
              ? <button aria-label="Delete announcement" onClick={() => confirm('Delete this announcement?') && delAnn(a.id)}>✕</button>
              : <Icon d={I.chevron} size={18} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Challenges({ back, go }) {
  const [tab, setTab] = useState('All Challenges');
  const [open, setOpen] = useState(null);
  const [mine, setMine] = useStored('challenge', null);
  const list = tab === 'My Challenges' ? challenges.filter((c) => c.id === mine) : challenges;
  return (
    <div className="screen">
      <Header title="Challenges" onBack={back} />
      <Hero className="short"><h3 className="script">Explore<br />Solve<br />Make an Impact</h3></Hero>
      <div className="sheet up">
        <div className="tabs pills green">{['All Challenges', 'My Challenges', 'Resources'].map((x) => <button key={x} aria-pressed={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>
        {tab === 'Resources' ? (
          resources.length === 0 ? <p className="empty">Datasets, APIs and design guides will be shared here by the organisers.</p> : resources.map((r) => (
            <a key={r.title} className="session" href={r.url} target="_blank" rel="noreferrer">
              <span className="annIcon General"><Icon d={I.file} /></span>
              <div className="grow"><b>{r.title}</b><small>{r.sub}</small></div><Icon d={I.chevron} size={18} />
            </a>
          ))
        ) : list.length === 0 ? (
          <p className="empty">You haven't picked a challenge yet.</p>
        ) : list.map((c) => (
          <div key={c.id} className="chRow" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <img className="thumb" src={c.img} alt={c.title} loading="lazy" />
            <div className="grow">
              <b>{c.id}. {c.title}</b>
              <p className={open === c.id ? '' : 'clamp'}>{c.body}</p>
              {open === c.id && (
                <button className="btn small" onClick={(e) => { e.stopPropagation(); setMine(c.id); go('submit'); }}>
                  {mine === c.id ? 'Selected — Submit project' : 'Choose this challenge'}
                </button>
              )}
            </div>
            <Icon d={I.chevron} size={18} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Timer({ deadline, setDeadline, isOrganiser, back }) {
  const t = useCountdown(deadline);
  const [exact, setExact] = useState('');
  const total = 12 * 3600;
  const pct = Math.min(1, t.left / total);
  const R = 90, C = 2 * Math.PI * R;
  const rem = t.isSet ? new Date(deadline - 10 * 60 * 1000) : null;
  return (
    <div className="screen dark">
      <Header title="" onBack={back} />
      <Hero className="timerHero">
        <Logo small />
        <h1 className="freeze">Code Freeze</h1>
        <p className="center">{t.isSet ? 'Submit your final solution before time runs out.' : 'The organisers have not started the timer yet.'}</p>
      </Hero>
      <div className="ringWrap">
        <svg width="230" height="230" viewBox="0 0 230 230">
          <circle cx="115" cy="115" r={R} stroke="#123f33" strokeWidth="14" fill="none" />
          <circle cx="115" cy="115" r={R} stroke="#1fd17f" strokeWidth="14" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 115 115)" />
        </svg>
        <div className="ringText"><b>{t.h}:{t.m}:{t.s}</b><small>Hours&nbsp;&nbsp;&nbsp;Minutes&nbsp;&nbsp;&nbsp;Seconds</small></div>
      </div>
      <div className="reminder">
        <Icon d={I.bell} />
        <div className="grow"><small>Next reminder</small><b>10 minutes before</b></div>
        <b>{rem ? `${pad(rem.getHours())}:${pad(rem.getMinutes())}` : '—'}</b>
      </div>
      <div className="alertBar">The timer is controlled by the organisers and applies to all teams.</div>
      {isOrganiser && (
        <div className="orgCtl">
          <small>Organiser controls</small>
          <div>
            <button onClick={() => setDeadline((deadline ?? Date.now()) - 15 * 60000)}>−15 min</button>
            <button onClick={() => setDeadline((deadline ?? Date.now()) + 15 * 60000)}>+15 min</button>
            <button onClick={() => setDeadline(Date.now() + 8 * 3600000)}>Set 8h</button>
          </div>
          <label className="exact">Exact time
            <input type="datetime-local" value={exact} onChange={(e) => setExact(e.target.value)} />
          </label>
          <div>
            <button disabled={!exact} onClick={() => { setDeadline(new Date(exact).getTime()); setExact(''); }}>Set exact time</button>
            <button onClick={() => confirm('Clear the timer?') && setDeadline(null)}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Programme({ back }) {
  const [day, setDay] = useState('Oct 16');
  return (
    <div className="screen">
      <Header photo="p7" title="Programme" onBack={back} />
      <div className="sheet">
        <div className="days">
          {days.map(([d, w]) => <button key={d} aria-pressed={day === d} className={day === d ? 'on' : ''} onClick={() => setDay(d)}><span>{d}</span><small>{w}</small></button>)}
        </div>
        {programme[day].length === 0 && <p className="empty">Programme to be announced.</p>}
        {programme[day].map(([time, title, where], i) => (
          <div key={i} className="session">
            <span className="dot" />
            <div className="grow"><small>{time}</small><b>{title}</b><small className="loc"><Icon d={I.pin} size={12} /> {where}</small></div>
            <Icon d={I.chevron} size={18} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Submit({ back, addSubmission, existing, frozen }) {
  const [mine] = useStored('challenge', null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [f, setF] = useState({
    title: existing?.title || '', category: existing ? String(existing.category) : mine ? String(mine) : '',
    desc: existing?.desc || '', demo: existing?.demo || '', repo: existing?.repo || '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const steps = ['Details', 'Demo & Files', 'Repository', 'Review'];
  const demoOk = isSafeUrl(f.demo);
  const repoOk = isSafeUrl(f.repo);
  const valid = [f.title && f.category && f.desc, demoOk, repoOk, demoOk && repoOk][step];
  const next = async () => {
    if (step < 3) return setStep(step + 1);
    setBusy(true);
    const ok = await addSubmission(f, file);
    setBusy(false);
    if (ok) setDone(true);
  };
  if (frozen) return (
    <div className="screen">
      <Header photo="p8" title="Submit Your Project" onBack={back} />
      <div className="sheet center"><h3>Code freeze</h3><p>Submissions are now closed.</p><button className="btn" onClick={back}>Back</button></div>
    </div>
  );
  if (done) return (
    <div className="screen">
      <Header photo="p8" title="Submit Your Project" onBack={back} />
      <div className="sheet center"><h3>🎉 Project {existing ? 'updated' : 'submitted'}!</h3><p>You can update it any time before code freeze.</p><button className="btn" onClick={back}>Done</button></div>
    </div>
  );
  return (
    <div className="screen">
      <Header photo="p8" title={existing ? 'Update Your Project' : 'Submit Your Project'} onBack={step ? () => setStep(step - 1) : back} />
      <div className="sheet form">
        <div className="steps">{steps.map((s, i) => <div key={s} className={i <= step ? 'on' : ''}><span>{i + 1}</span><small>{s}</small></div>)}</div>
        {step === 0 && <>
          <label>Project Title *<input placeholder="Enter your project title" value={f.title} onChange={set('title')} /></label>
          <label>Challenge Category *
            <select value={f.category} onChange={set('category')}>
              <option value="">Select a challenge</option>
              {challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label>Project Description *
            <textarea maxLength={500} rows={4} placeholder="Describe your solution, impact and key features…" value={f.desc} onChange={set('desc')} />
            <small className="count">{f.desc.length}/500</small>
          </label>
        </>}
        {step === 1 && <>
          <label>Demo Link (optional)<input type="url" placeholder="https://your-demo-link.com" value={f.demo} onChange={set('demo')} />{!demoOk && <small className="fieldErr" role="alert">Links must start with http:// or https://</small>}</label>
          <label>Slides or file (optional, max 10 MB)
            <input type="file" accept=".pdf,.ppt,.pptx,.zip,.png,.jpg,.mp4" onChange={(e) => setFile(e.target.files[0] || null)} />
            {existing?.file_url && !file && <small><a href={existing.file_url} target="_blank" rel="noreferrer">Current file</a> (choose a new one to replace it)</small>}
          </label>
        </>}
        {step === 2 && <label>Repository Link (optional)<input type="url" placeholder="https://github.com/your-repo" value={f.repo} onChange={set('repo')} />{!repoOk && <small className="fieldErr" role="alert">Links must start with http:// or https://</small>}</label>}
        {step === 3 && (
          <div className="review">
            <p><small>Title</small>{f.title}</p>
            <p><small>Challenge</small>{challenges.find((c) => String(c.id) === String(f.category))?.title}</p>
            <p><small>Description</small>{f.desc}</p>
            <p><small>Demo</small>{f.demo || '—'}</p>
            <p><small>File</small>{file ? file.name : existing?.file_url ? 'Keeping current file' : '—'}</p>
            <p><small>Repository</small>{f.repo || '—'}</p>
          </div>
        )}
        <button className="btn" disabled={!valid || busy} onClick={next}>{busy ? 'Saving…' : step === 3 ? (existing ? 'Update' : 'Submit') : 'Next'}</button>
      </div>
    </div>
  );
}

function Login({ onLogin, emailLink }) {
  const [f, setF] = useState({ name: '', team: '', role: 'Hackers', code: '', teamCode: '', email: '', phone: '', organisation: '', skills: '', motivation: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const hacker = f.role === 'Hackers';
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('join');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (mode === 'email') { await emailLink(email); setSent(true); } else await onLogin(f);
    } catch (x) { setErr(x.message || 'Could not sign in'); }
    setBusy(false);
  };
  return (
    <div className="screen">
      <Hero className="tall"><Logo /><h1 className="homeTitle">Welcome to the<br />Hackathon Hub</h1><p className="tag">Apply to take part, or sign in with your access code</p></Hero>
      <form className="form pull" onSubmit={submit}>
        <div className="card">
          {mode === 'email' ? <>
            <label>Email you saved to your account<input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {sent && <p className="empty" role="status">Check your inbox for the sign-in link.</p>}
          </> : <>
            <label>Your name<input required placeholder="e.g. Thabo Mokoena" value={f.name} onChange={set('name')} /></label>
            <label>I am a<select value={f.role} onChange={set('role')}>{['Hackers', 'Mentor', 'Judge', 'Organiser'].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Team<input required placeholder="e.g. Team Alpha" value={f.team} onChange={set('team')} /></label>
            {hacker ? <>
              <label>Team code<input required type="password" minLength={4} placeholder="New team? Choose one. Joining? Ask a teammate." value={f.teamCode} onChange={set('teamCode')} /></label>
              <label>Email<input required type="email" maxLength={200} placeholder="you@example.com" value={f.email} onChange={set('email')} /></label>
              <label>Phone (optional)<input type="tel" maxLength={30} placeholder="e.g. 072 123 4567" value={f.phone} onChange={set('phone')} /></label>
              <label>School, university or organisation<input required maxLength={200} placeholder="e.g. University of Mpumalanga" value={f.organisation} onChange={set('organisation')} /></label>
              <label>Skills (optional)<input maxLength={500} placeholder="e.g. React, design, data, marketing" value={f.skills} onChange={set('skills')} /></label>
              <label>Why do you want to take part?<textarea required rows={3} maxLength={1000} placeholder="A few lines about you and what you'd like to build" value={f.motivation} onChange={set('motivation')} /></label>
            </> : <label>Access code<input required type="password" placeholder="Given to you by the organisers" value={f.code} onChange={set('code')} /></label>}
          </>}
          {err && <p className="empty" role="alert">{err}</p>}
          <small className="finePrint">{hacker && mode === 'join' ? 'Organisers review every application and can see your email and phone number. ' : ''}By joining you agree that your name, team and messages are shared with other participants. See Settings &gt; Privacy after signing in.</small>
          <button className="btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'email' ? 'Email me a sign-in link' : hacker ? 'Apply to join' : 'Join the Hackathon'}</button>
          <button type="button" className="linkBtn" onClick={() => { setMode(mode === 'join' ? 'email' : 'join'); setErr(''); setSent(false); }}>
            {mode === 'join' ? 'Already saved your account? Sign in with email' : 'Back to join'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Shown to hackers until an organiser approves them.
function ApplicationStatus({ user, refresh }) {
  const rejected = user.status === 'rejected';
  const [note, setNote] = useState('');
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (rejected) supabase.from('applications').select('note').eq('id', user.id).maybeSingle().then(({ data }) => setNote(data?.note || ''));
  }, [rejected, user.id]);
  const check = async () => { setChecking(true); await refresh(); setChecking(false); };
  const erase = async () => {
    if (!confirm(rejected ? 'Delete your details permanently?' : 'Withdraw your application and delete your details?')) return;
    const { error } = await supabase.rpc('delete_my_data');
    if (error) alert(error.message); else { await supabase.auth.signOut(); localStorage.clear(); location.reload(); }
  };
  return (
    <div className="screen">
      <Hero className="tall"><Logo /><h1 className="homeTitle">{rejected ? 'Application not accepted' : 'Application received'}</h1><p className="tag">{rejected ? 'Thank you for your interest' : 'Waiting for the organisers'}</p></Hero>
      <div className="form pull">
        <div className="card">
          {rejected ? <>
            <p className="empty">Thank you for applying, {user.name}. Unfortunately the organisers could not offer you a place this time.</p>
            {note && <div className="review"><p><small>Note from the organisers</small>{note}</p></div>}
          </> : <>
            <p className="empty">Thanks, {user.name}. The organisers will review your application for <b>{user.team}</b>. This page updates by itself once they decide.</p>
            <small className="finePrint">Stay signed in on this device. Your application is linked to this browser until you are approved.</small>
            <button className="btn" disabled={checking} onClick={check}>{checking ? 'Checking…' : 'Check again'}</button>
          </>}
          <button className="btn danger" onClick={erase}>{rejected ? 'Delete my details' : 'Withdraw application'}</button>
        </div>
      </div>
    </div>
  );
}

function Applications({ back, profiles, apps, review }) {
  const [tab, setTab] = useState('pending');
  const byId = Object.fromEntries(apps.map((a) => [a.id, a]));
  const people = profiles.filter((p) => byId[p.id]);
  const count = (s) => people.filter((p) => p.status === s).length;
  const list = people.filter((p) => p.status === tab);
  const decide = (p, status) => {
    if (status === 'rejected') {
      const note = prompt(`Reject ${p.name}? Optional reason (the applicant will see it):`, '');
      if (note !== null) review(p.id, status, note);
    } else review(p.id, status);
  };
  return (
    <Page title="Applications" photo="p4" back={back}>
      <div className="tabs pills green">
        {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([k, l]) => (
          <button key={k} aria-pressed={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} ({count(k)})</button>
        ))}
      </div>
      {list.length === 0 && <p className="empty">No {tab} applications.</p>}
      {list.map((p) => {
        const a = byId[p.id];
        return (
          <div key={p.id} className="ann">
            <div className="grow">
              <span className="chip General">{p.team}</span>
              <b>{p.name}</b>
              <p>{a.organisation}</p>
              <p><a href={`mailto:${a.email}`}>{a.email}</a>{a.phone && <> · <a href={`tel:${a.phone}`}>{a.phone}</a></>}</p>
              {a.skills && <p><small>Skills: </small>{a.skills}</p>}
              <p>{a.motivation}</p>
              {a.note && <p><small>Note: </small>{a.note}</p>}
              <small>Applied {new Date(a.created_at).toLocaleString()}</small>
              <div>
                {p.status !== 'approved' && <button className="btn small" onClick={() => decide(p, 'approved')}>Approve</button>}{' '}
                {p.status !== 'rejected' && <button className="btn small danger" onClick={() => decide(p, 'rejected')}>Reject</button>}
              </div>
            </div>
          </div>
        );
      })}
    </Page>
  );
}

function Page({ title, back, photo, children }) {
  return <div className="screen"><Header photo={photo} title={title} onBack={back} /><div className="sheet">{children}</div></div>;
}

function MyTeam({ back, user, members }) {
  return (
    <Page title="My Team" photo="p8" back={back}>
      <h3 className="pageTitle">{user.team}</h3>
      {members.map((m) => (
        <div key={m.id} className="chatRow"><span className="avatar photo" style={{ backgroundImage: `url(${img('p8')})` }} />
          <div className="grow"><b>{m.name}{m.id === user.id ? ' (you)' : ''}</b><small>{m.role}</small></div></div>
      ))}
    </Page>
  );
}

function MySubmissions({ back, submissions, user, go }) {
  const mine = submissions.filter((x) => x.team === user.team);
  return (
    <Page title="My Submissions" photo="p9" back={back}>
      {mine.length === 0 && <div className="empty">No submissions yet.<br /><button className="btn small" onClick={() => go('submit')}>Submit a project</button></div>}
      {mine.length > 0 && <button className="btn small" onClick={() => go('submit')}>Update submission</button>}
      {mine.map((x, i) => (
        <div key={i} className="ann"><div className="grow">
          <span className="chip General">{challenges.find((c) => String(c.id) === String(x.category))?.title}</span>
          <b>{x.title}</b><p>{x.desc}</p>
          {x.demo && <p><a href={safeHref(x.demo)} target="_blank" rel="noreferrer">Demo</a></p>}
          {x.repo && <p><a href={safeHref(x.repo)} target="_blank" rel="noreferrer">Repository</a></p>}
          {x.file_url && <p><a href={x.file_url} target="_blank" rel="noreferrer">Uploaded file</a></p>}
          <small>{new Date(x.at).toLocaleString()} · by {x.by}</small></div></div>
      ))}
    </Page>
  );
}

function ScoreCard({ sub, mine, onSave, onDelete, isOrganiser }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ impact: mine?.impact ?? 5, innovation: mine?.innovation ?? 5, technical: mine?.technical ?? 5, pitch: mine?.pitch ?? 5, comment: mine?.comment ?? '' });
  const [saved, setSaved] = useState(false);
  const title = challenges.find((c) => String(c.id) === String(sub.category))?.title;
  return (
    <div className="ann scoreCard">
      <div className="grow">
        <span className="chip General">{title}</span>
        <b onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>{sub.title} <small>— {sub.team}{mine ? ' ✓ scored' : ''}</small></b>
        {open && <>
          <p>{sub.desc}</p>
          {sub.demo && <p><a href={safeHref(sub.demo)} target="_blank" rel="noreferrer">Demo</a></p>}
          {sub.repo && <p><a href={safeHref(sub.repo)} target="_blank" rel="noreferrer">Repository</a></p>}
          {sub.file_url && <p><a href={sub.file_url} target="_blank" rel="noreferrer">Uploaded file</a></p>}
          {CRITERIA.map(([k, l]) => (
            <label key={k} className="slider">{l}: <b>{v[k]}</b>
              <input type="range" min="1" max="10" value={v[k]} onChange={(e) => { setSaved(false); setV({ ...v, [k]: +e.target.value }); }} />
            </label>
          ))}
          <textarea rows={2} placeholder="Comment (optional)" value={v.comment} onChange={(e) => { setSaved(false); setV({ ...v, comment: e.target.value }); }} />
          <button className="btn small" onClick={async () => { if (await onSave(sub.id, v)) setSaved(true); }}>{saved ? 'Saved ✓' : mine ? 'Update score' : 'Save score'}</button>
          {isOrganiser && <button className="btn small danger" onClick={() => confirm('Delete this submission?') && onDelete(sub.id)}>Delete submission</button>}
        </>}
      </div>
    </div>
  );
}

function Judging({ back, user, submissions, scores, saveScore, delSubmission }) {
  const isOrganiser = user.role === 'Organiser';
  const [tab, setTab] = useState('Score');
  const mineBySub = {};
  scores.filter((x) => x.judge_id === user.id).forEach((x) => { mineBySub[x.submission_id] = x; });
  const results = computeResults(submissions, scores);
  return (
    <Page title="Judging" photo="p4" back={back}>
      {isOrganiser && <div className="tabs pills green">{['Score', 'Results'].map((x) => <button key={x} aria-pressed={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>}
      {tab === 'Score' && (submissions.length === 0
        ? <p className="empty">No submissions yet.</p>
        : submissions.map((sub) => <ScoreCard key={sub.id} sub={sub} mine={mineBySub[sub.id]} onSave={saveScore} onDelete={delSubmission} isOrganiser={isOrganiser} />))}
      {tab === 'Results' && results.length > 0 && <button className="btn small" onClick={() => downloadCsv('results.csv', resultsToCsv(results))}>Export CSV</button>}
      {tab === 'Results' && (results.length === 0
        ? <p className="empty">No submissions yet.</p>
        : results.map((r, i) => (
          <div key={r.sub.id} className="ann">
            <span className="annIcon General"><Icon d={I.trophy} /></span>
            <div className="grow">
              <b>{i + 1}. {r.sub.title} <small>— {r.sub.team}</small></b>
              <p>Total {r.total.toFixed(1)} / 40 · {r.n} judge{r.n === 1 ? '' : 's'}</p>
              <small>{CRITERIA.map(([k, l]) => `${l} ${r.avg(k).toFixed(1)}`).join(' · ')}</small>
            </div>
          </div>
        )))}
    </Page>
  );
}

function downloadCsv(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Dashboard({ back, profiles, submissions, scores, messages, pending }) {
  const hackers = profiles.filter((p) => p.role === 'Hackers');
  const teams = [...new Set(hackers.map((p) => p.team))];
  const submitted = new Set(submissions.map((x) => x.team));
  const judged = new Set(scores.map((x) => x.submission_id));
  const stats = [
    ['Hackers', hackers.length], ['Teams', teams.length], ['Mentors', profiles.filter((p) => p.role === 'Mentor').length],
    ['Judges', profiles.filter((p) => p.role === 'Judge').length], ['Submissions', submissions.length],
    ['Judged', `${submissions.filter((x) => judged.has(x.id)).length}/${submissions.length}`], ['Messages', messages],
    ['Pending applications', pending],
  ];
  const missing = teams.filter((t) => !submitted.has(t));
  return (
    <Page title="Dashboard" photo="p4" back={back}>
      <div className="statGrid">{stats.map(([l, v]) => <div key={l} className="stat"><b>{v}</b><small>{l}</small></div>)}</div>
      <h3 className="pageTitle">Teams without a submission</h3>
      {missing.length === 0 ? <p className="empty">Every team has submitted.</p> : missing.map((t) => <p key={t} className="credit">{t}</p>)}
      <button className="btn small" onClick={() => downloadCsv('participants.csv', ['Name,Team,Role', ...profiles.map((p) => [p.name, p.team, p.role].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n'))}>Export participants CSV</button>
    </Page>
  );
}

function Privacy({ back }) {
  return (
    <Page title="Privacy" photo="p5" back={back}>
      <h3 className="pageTitle">What we collect</h3>
      <p className="credit">Your name, team, role, the messages you send in the app, and any project details or files your team submits. If you applied as a hacker: the email, phone number, organisation, skills and motivation from your application, which only organisers can see. If you save an account, your email address.</p>
      <h3 className="pageTitle">Why</h3>
      <p className="credit">To run the hackathon: chat, announcements, submissions and judging. We do not sell your data or use it for advertising.</p>
      <h3 className="pageTitle">Who can see it</h3>
      <p className="credit">Chat in General and Mentors is visible to all participants. Team chat is visible to your team. Judges and organisers can see submissions and scores.</p>
      <h3 className="pageTitle">Keeping and deleting it</h3>
      <p className="credit">You can erase your profile and messages at any time under Settings &gt; Delete my data. Organisers will remove remaining event data after the event closes. Team submissions may be kept for results, without your name.</p>
      <h3 className="pageTitle">Contact</h3>
      <p className="credit">Ask an organiser at the event desk. (Organisers: add an official contact email here in src/App.jsx.)</p>
    </Page>
  );
}

function Settings_account({ user }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ email });
    setMsg(error ? error.message : 'Check your inbox to confirm. After that you can sign in with this email on any device.');
  };
  return (
    <form className="form" onSubmit={save}>
      <h3 className="pageTitle">Save my account</h3>
      <label>Email<input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <button className="btn small">Save account</button>
      {msg && <p className="empty" role="status">{msg}</p>}
      <small>Signed in as {user.name}. Without an email, logging out loses access to this profile.</small>
    </form>
  );
}

function Resources({ back }) {
  return (
    <Page title="Resources" photo="p5" back={back}>
      {resources.length === 0 && <p className="empty">No resources have been shared yet.</p>}
      {resources.map((r) => (
        <a key={r.title} className="session" href={r.url} target="_blank" rel="noreferrer">
          <span className="annIcon General"><Icon d={I.file} /></span>
          <div className="grow"><b>{r.title}</b><small>{r.sub}</small></div><Icon d={I.chevron} size={18} />
        </a>
      ))}
    </Page>
  );
}

function Faqs({ back }) {
  const [open, setOpen] = useState(0);
  return (
    <Page title="FAQs" photo="p3" back={back}>
      {faqs.length === 0 && <p className="empty">No FAQs yet.</p>}
      {faqs.map(([q, a], i) => (
        <div key={q} className="faq" onClick={() => setOpen(open === i ? -1 : i)}>
          <b>{q}</b>{open === i && <p>{a}</p>}
        </div>
      ))}
    </Page>
  );
}

function Settings({ back, user, reset, go }) {
  const [notif, setNotif] = useStored('notif', true);
  return (
    <Page title="Settings" photo="p5" back={back}>
      <label className="switch"><span>Code-freeze reminders</span><input type="checkbox" checked={notif} onChange={(e) => { setNotif(e.target.checked); if (e.target.checked && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }} /></label>
      <Settings_account user={user} />
      <h3 className="pageTitle">Photo credits</h3>
      {credits.map((c) => (
        <p key={c.file} className="credit"><a href={c.url} target="_blank" rel="noreferrer">{c.title.replace(/\.jpg$/, '')}</a> by {c.author} — {c.license}, via Wikimedia Commons</p>
      ))}
      <p className="empty">Signed in as {user.name} ({user.role})</p>
      <button className="btn" onClick={() => go('privacy')}>Privacy &amp; data</button>
      <button className="btn danger" onClick={async () => {
        if (!confirm('Delete your profile and messages permanently? This cannot be undone.')) return;
        const { error } = await supabase.rpc('delete_my_data');
        if (error) alert(error.message); else { localStorage.clear(); location.reload(); }
      }}>Delete my data</button>
      <button className="btn danger" onClick={() => { if (confirm('Clear all local hackathon data on this device?')) reset(); }}>Reset app data</button>
    </Page>
  );
}

function More({ go, user, logout, pending }) {
  const staff = user.role === 'Judge' || user.role === 'Organiser';
  const items = [...(staff ? [['Judging', 'trophy', 'judging']] : []), ...(user.role === 'Organiser' ? [[`Applications${pending ? ` (${pending})` : ''}`, 'user', 'applications'], ['Dashboard', 'group', 'dashboard']] : []), ['My Team', 'team', 'myteam'], ['My Submissions', 'file', 'mysubs'], ['Resources', 'file', 'resources'], ['FAQs', 'help', 'faqs'], ['Settings', 'gear', 'settings'], ['Help & Support', 'help', 'chat:mentors'], ['Logout', 'logout', 'LOGOUT']];
  return (
    <div className="screen">
      <Hero className="mid"><h1>More</h1></Hero>
      <div className="pull">
        <div className="profile">
          <span className="avatar big"><Icon d={I.user} size={30} /></span>
          <div><b>{user.name}</b><small>{user.team}</small><span className="chip Hackers">{user.role}</span></div>
        </div>
        <div className="menu">
          {items.map(([l, ic, to]) => (
            <button key={l} onClick={() => (to === 'LOGOUT' ? logout() : go(to))}><Icon d={I[ic]} size={20} /><span>{l}</span><Icon d={I.chevron} size={16} /></button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- app shell ---------- */
export default function App() {
  if (!configured) {
    return <div className="phoneWrap"><div className="phone"><div className="body"><p className="empty">Backend not configured. Copy .env.example to .env and add your Supabase URL and anon key, then restart.</p></div></div></div>;
  }
  return <Authed />;
}

function Authed() {
  const { ready, profile, join, logout, emailLink, refresh } = useAuth();
  const frame = (child) => <div className="phoneWrap"><div className="phone"><div className="status"><span>9:41</span><span>●●● ▮</span></div><div className="body">{child}</div></div></div>;
  if (!ready) return frame(<p className="empty">Loading…</p>);
  if (!profile) return frame(<Login onLogin={join} emailLink={emailLink} />);
  if (profile.status !== 'approved') return frame(<ApplicationStatus user={profile} refresh={refresh} />);
  return <Main user={profile} logout={logout} />;
}

function Main({ user, logout }) {
  const [stack, setStack] = useState(['home']);
  const screen = stack[stack.length - 1];
  const [chatId, setChatId] = useState(null);
  const [annSeen, setAnnSeen] = useStored('annSeen', 0);
  const [msgRows, reloadMsgs] = useTable('messages', true, 300);
  const [outbox, setOutbox] = useStored('outbox', []);
  const flushing = useRef(false);
  const [annRows, reloadAnns] = useTable('announcements');
  const [subRows, reloadSubs] = useTable('submissions');
  const staff = user.role === 'Judge' || user.role === 'Organiser';
  const [scoreRows, reloadScores] = useTable('scores', staff || user.role === 'Organiser');
  const [allProfiles] = useTable('profiles');
  // Organisers also receive pending/rejected applicants; everyone else only sees approved people.
  const profileRows = allProfiles.filter((p) => p.status === 'approved');
  const [appRows, reloadApps] = useTable('applications', user.role === 'Organiser');
  const pendingCount = allProfiles.filter((p) => p.status === 'pending').length;
  const [notif] = useStored('notif', true);
  const online = useOnline();
  const [toast, setToast] = useState('');
  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };
  const [chatSeen, setChatSeen] = useStored('chatSeen', {});
  const [dl, saveDl] = useSetting('deadline');
  const deadline = dl?.ts ?? null;
  const setDeadline = (ts) => saveDl({ ts });
  const isOrganiser = user.role === 'Organiser';
  const t = useCountdown(deadline);
  const frozen = t.isSet && t.left === 0 && !isOrganiser;
  const soon = notif && t.isSet && t.left > 0 && t.left <= 600;
  const notified = useRef(false);
  useEffect(() => {
    if (soon && !notified.current) {
      notified.current = true;
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Code freeze in 10 minutes', { body: 'Submit your final solution now.', icon: '/icon.svg' }); } catch { /* ignore */ }
    }
    if (!soon && t.left > 600) notified.current = false;
  }, [soon, t.left]);

  const messages = {};
  msgRows.forEach((m) => {
    (messages[m.channel] ||= []).push({ id: m.id, from: m.from_name, text: m.text, time: formatStamp(m.created_at) });
  });
  const anns = [...annRows].reverse().map((a) => {
    const d = new Date(a.created_at);
    return { ...a, time: `${d.toLocaleDateString()} ${pad(d.getHours())}:${pad(d.getMinutes())}` };
  });
  const submissions = subRows.map((x) => ({ ...x, desc: x.descr, by: x.by_name, at: x.created_at }));
  const postAnn = async (a) => {
    const { error } = await supabase.from('announcements').insert({ tag: a.tag, title: a.title, body: a.body, urgent: a.tag === 'Important' });
    if (error) notify(error.message); else reloadAnns();
  };
  const delAnn = async (id) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) notify(error.message); else reloadAnns();
  };
  const addSubmission = async (x, file) => {
    const row = { title: x.title, category: String(x.category), descr: x.desc, demo: x.demo, repo: x.repo, updated_at: new Date().toISOString() };
    if (file) {
      if (file.size > 10 * 1024 * 1024) { notify('File is larger than 10 MB'); return false; }
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const up = await supabase.storage.from('submissions').upload(path, file);
      if (up.error) { notify(up.error.message); return false; }
      row.file_url = supabase.storage.from('submissions').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from('submissions').upsert(row, { onConflict: 'team' });
    if (error) { notify(error.message); return false; }
    reloadSubs(); return true;
  };
  const saveScore = async (submission_id, v) => {
    const { error } = await supabase.from('scores').upsert({ submission_id, judge_id: user.id, ...v }, { onConflict: 'submission_id,judge_id' });
    if (error) { notify(error.message); return false; }
    reloadScores(); return true;
  };
  const review = async (id, status, note = '') => {
    const { error } = await supabase.rpc('review_application', { p_id: id, p_status: status, p_note: note });
    if (error) notify(error.message); else { reloadApps(); notify(status === 'approved' ? 'Approved' : 'Rejected'); }
  };
  const delSubmission = async (id) => {
    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (error) notify(error.message); else reloadSubs();
  };

  const tabFor = { home: 'home', chat: 'chat', room: 'chat', alerts: 'alerts', more: 'more' };
  const [chatTab, setChatTab] = useState('all');
  const go = (target) => {
    const [s, arg] = target.split(':');
    if (s === 'chat') setChatTab(arg || 'all');
    setStack((st) => (['home', 'chat', 'alerts', 'more'].includes(s) ? [s] : [...st, s]));
  };
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  const openChat = (id) => { setChatId(id); setStack((st) => [...st, 'room']); };
  const isNetworkError = (error) => !navigator.onLine || /fetch|network|timeout/i.test(error?.message || '');
  const send = async (id, text) => {
    if (!navigator.onLine) { setOutbox((o) => [...o, { channel: id, text }]); notify('Offline - your message will send when you reconnect'); return; }
    const { error } = await supabase.from('messages').insert({ channel: id, text });
    if (!error) { reloadMsgs(); return; }
    if (isNetworkError(error)) { setOutbox((o) => [...o, { channel: id, text }]); notify('Connection problem - will retry automatically'); } else notify(error.message);
  };
  // Send queued messages (oldest first) whenever we're back online.
  useEffect(() => {
    if (!online || outbox.length === 0 || flushing.current) return;
    flushing.current = true;
    (async () => {
      const queue = [...outbox];
      let sent = 0;
      for (const m of queue) {
        const { error } = await supabase.from('messages').insert(m);
        if (error && isNetworkError(error)) break;
        if (error) notify(error.message);
        sent += 1;
      }
      if (sent) setOutbox((o) => o.slice(sent));
      flushing.current = false;
      if (sent) reloadMsgs();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, outbox.length]);
  const delMsg = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) notify(error.message); else reloadMsgs();
  };
  const unreadBy = {};
  Object.keys(messages).forEach((k) => { unreadBy[k] = Math.max(0, messages[k].length - (chatSeen[k] || 0)); });
  const chatUnread = Object.values(unreadBy).reduce((t, n) => t + n, 0);
  const roomCount = chatId ? (messages[chatId] || []).length : 0;
  useEffect(() => {
    if (screen === 'room' && chatId && (chatSeen[chatId] || 0) !== roomCount) setChatSeen({ ...chatSeen, [chatId]: roomCount });
  }, [screen, chatId, roomCount, chatSeen, setChatSeen]);
  const unreadTotal = Math.max(0, anns.length - annSeen);
  useEffect(() => { if (screen === 'alerts' && annSeen !== anns.length) setAnnSeen(anns.length); }, [screen, anns.length, annSeen, setAnnSeen]);

  const nav = [['home', 'Home', I.home], ['chat', 'Chat', I.chat], ['alerts', 'Alerts', I.bell], ['more', 'Profile', I.user]];
  const active = tabFor[screen] ?? stack.find((s) => tabFor[s]) ?? 'home';
  const hideNav = screen === 'timer';

  return (
    <div className="phoneWrap">
      <div className={`phone ${hideNav ? '' : 'hasNav'}`}>
        <div className="status"><span>9:41</span><span>●●● ▮</span></div>
        <div className="body" role="main">
          {!online && <div className="freezeBanner offline" role="status">You're offline — messages and changes won't be saved until you reconnect</div>}
          {soon && <div className="freezeBanner" role="alert">⏰ Code freeze in {t.m}:{t.s} — submit your final solution now</div>}
          {frozen && <div className="freezeBanner done" role="alert">Code freeze — submissions are closed</div>}
          {screen === 'home' && <Home go={go} deadline={deadline} unread={unreadTotal} />}
          {screen === 'chat' && <ChatList key={chatTab} unreadBy={unreadBy} initialTab={chatTab} openChat={openChat} back={() => go('home')} messages={messages} user={user} />}
          {screen === 'room' && <ChatRoom id={chatId} back={back} messages={messages} send={send} delMsg={delMsg} pending={outbox.filter((o) => o.channel === chatId)} user={user} />}
          {screen === 'alerts' && <Announcements back={() => go('home')} anns={anns} postAnn={postAnn} delAnn={delAnn} isOrganiser={isOrganiser} />}
          {screen === 'challenges' && <Challenges back={back} go={go} />}
          {screen === 'timer' && <Timer deadline={deadline} setDeadline={setDeadline} isOrganiser={isOrganiser} back={back} />}
          {screen === 'programme' && <Programme back={back} />}
          {screen === 'submit' && <Submit back={back} addSubmission={addSubmission} frozen={frozen} existing={submissions.find((x) => x.team === user.team)} />}
          {screen === 'dashboard' && isOrganiser && <Dashboard back={back} profiles={profileRows} submissions={submissions} scores={scoreRows} messages={msgRows.length} pending={pendingCount} />}
          {screen === 'applications' && isOrganiser && <Applications back={back} profiles={allProfiles} apps={appRows} review={review} />}
          {screen === 'judging' && staff && <Judging back={back} user={user} submissions={submissions} scores={scoreRows} saveScore={saveScore} delSubmission={delSubmission} />}
          {screen === 'more' && <More go={go} user={user} pending={pendingCount} logout={() => { logout(); setStack(['home']); }} />}
          {screen === 'myteam' && <MyTeam back={back} user={user} members={profileRows.filter((m) => m.team === user.team)} />}
          {screen === 'mysubs' && <MySubmissions back={back} submissions={submissions} user={user} go={go} />}
          {screen === 'resources' && <Resources back={back} />}
          {screen === 'faqs' && <Faqs back={back} />}
          {screen === 'privacy' && <Privacy back={back} />}
          {screen === 'settings' && <Settings back={back} user={user} go={go} reset={async () => { await logout(); localStorage.clear(); location.reload(); }} />}
        </div>
        {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
        {!hideNav && (
          <nav className="nav">
            {nav.map(([k, l, d]) => (
              <button key={k} aria-label={l} aria-pressed={active === k} className={active === k ? 'on' : ''} onClick={() => go(k)}>
                <span><Icon d={d} size={22} />{k === 'alerts' && unreadTotal > 0 && <em>{unreadTotal}</em>}{k === 'chat' && chatUnread > 0 && <em>{chatUnread}</em>}</span><small>{l}</small>
              </button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
