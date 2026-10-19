import React, { useEffect, useRef, useState } from 'react';
import credits from './credits.json';
import { configured, useAuth, useTable, useSetting, useOnline, supabase } from './backend.js';
import { isSafeUrl, safeHref } from './safe.js';
import { CRITERIA, computeResults, resultsToCsv, formatStamp } from './scoring.js';
import { getChats, challenges, programme, days, faqs, resources, event } from './data.js';
import { startWorld } from './world.js';

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
  arrowRight: ['M5 12h14', 'M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5', 'M11 6l-6 6 6 6'],
  stamp: ['M9.5 3h5v4.5l-1 4.5h-3l-1-4.5z', 'M4.5 13.5h15V17h-15z', 'M6 20.5h12'],
  mail: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  key: ['M14.5 9.5a4 4 0 10-1.2 2.8', 'M13.3 12.3L21 20', 'M18 17l2-2', 'M16 15l1.5-1.5'],
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
function Home({ go, deadline, unread, isOrganiser, pending }) {
  const t = useCountdown(deadline);
  const tiles = [
    ['Team Chat', 'Talk to your team', 'chat', 'chat', '#22b573'],
    ['Announcements', 'Official updates', 'alerts', 'mega', '#f5a623'],
    ['Challenges', 'Choose a problem', 'challenges', 'bulb', '#7c5cff'],
    ['Programme', 'Sessions & deadlines', 'programme', 'cal', '#17b8a6'],
    ['Mentors & Judges', 'Get support', 'chat:mentors', 'team', '#eb4d6b'],
    isOrganiser
      ? ['Applications', pending ? `${pending} waiting for you` : 'Review sign-ups', 'applications', 'user', '#2f80ed']
      : ['Submit Project', 'Upload your solution', 'submit', 'upload', '#2f80ed'],
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

// An inline fill-in-the-blank input.
// A hidden copy of the text in the same grid cell sets the width, so it fits exactly.
const Blank = ({ value, placeholder, type, ...rest }) => (
  <span className="blankWrap" data-value={(type === 'password' ? '•'.repeat(value.length) : value) || placeholder}>
    <input data-blank className="blank" type={type} placeholder={placeholder} value={value} size={1} {...rest} />
  </span>
);

// Signing up is a road trip along the Panorama Route: one question per stop,
// and the photo behind you changes to that stop as you go.
const ROUTE = [
  { place: 'Graskop', img: 'graskop', fact: 'The gateway to the Panorama Route, and home of the famous pancakes.' },
  { place: "Pilgrim's Rest", img: 'pilgrims', fact: 'A gold-rush town kept much as it was since gold was found here in 1873.' },
  { place: 'Lisbon Falls', img: 'lisbon', fact: 'At 94 metres, the highest waterfall in Mpumalanga.' },
  { place: "Bourke's Luck Potholes", img: 'bourkes', fact: 'Rock carved into deep cylinders by centuries of swirling water.' },
  { place: "God's Window", img: 'godswindow', fact: 'On a clear day the view stretches across the Lowveld towards Kruger.' },
  { place: 'Blyde River Canyon', img: 'blyde', fact: 'One of the largest green canyons on Earth. You made it.' },
];
// Full-screen photos: 1920px on computers, a lighter 1280px set on phones (see public/images/route).
const routePhoto = (r) => `/images/route/${r.img}-${window.matchMedia('(min-width: 900px)').matches ? 1920 : 1280}.jpg`;
// Hidden staff sign-in address. Not linked anywhere; access codes are still what keeps it safe.
const STAFF_PATH = '/staff';
const STAFF = window.location.pathname.replace(/\/+$/, '') === STAFF_PATH;
const ROLES = [['Hackers', 'a hacker'], ['Mentor', 'a mentor'], ['Judge', 'a judge'], ['Organiser', 'an organiser']];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROAD = 'M 10 50 C 120 8, 210 84, 330 44 S 540 8, 660 46 S 860 82, 990 30';

// Winding road along the bottom. The gold part is how far you have come; reached stops can be tapped to go back.
function RouteMap({ stops, here, reached, go }) {
  const ref = useRef(null);
  const [pts, setPts] = useState(null);
  useEffect(() => {
    const p = ref.current;
    const len = p.getTotalLength();
    setPts(stops.map((_, i) => p.getPointAtLength((len * i) / (stops.length - 1))));
  }, [stops.length]);
  const doneX = pts ? pts[here].x : 0;
  return (
    <div className="routeMap">
      <svg viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true">
        <defs><clipPath id="routeDone"><rect className="doneClip" width="1000" height="90" style={{ transform: `scaleX(${doneX / 1000})` }} /></clipPath></defs>
        <path ref={ref} className="road" d={ROAD} />
        <path className="done" d={ROAD} clipPath="url(#routeDone)" />
      </svg>
      {pts && stops.map((s, i) => (
        <button key={s.place} type="button" disabled={i > reached} onClick={() => go(i)}
          className={`pin ${i <= reached ? 'reached' : ''} ${i === here ? 'here' : ''}`}
          style={{ left: `${pts[i].x / 10}%`, top: `${(pts[i].y / 90) * 100}%` }}
          aria-label={`${s.place}${i === here ? ', you are here' : i > reached ? ', not reached yet' : ''}`}>
          <i /><span>{s.place}</span>
        </button>
      ))}
    </div>
  );
}

// The public landing page is the hacker application. Mentors, judges and organisers
// sign in at the unlinked /staff address instead (see STAFF_PATH).
function Login({ onLogin, emailLink, staff, initialMode = 'join', onHome }) {
  const [f, setF] = useState({ name: '', team: '', role: staff ? 'Organiser' : 'Hackers', code: '', teamCode: '', email: '', phone: '', organisation: '', skills: '', motivation: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const hacker = f.role === 'Hackers';
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [stamped, setStamped] = useState(false);
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  // Staff only pass three stops: who you are, your access code, then the pass.
  const stops = hacker ? ROUTE : [ROUTE[0], ROUTE[1], ROUTE[5]];
  const last = stops.length - 1;
  const valid = hacker
    ? [f.name.trim(), f.team.trim() && f.teamCode.length >= 4, EMAIL_RE.test(f.email.trim()), f.organisation.trim(), f.motivation.trim(), true]
    : [f.name.trim(), f.team.trim() && f.code, true];
  const [step, setStep] = useState(0);
  const [reachedRaw, setReached] = useState(0);
  const reached = Math.min(reachedRaw, last);
  const go = (i) => { setErr(''); setStamped(false); setStep(i); setReached((r) => Math.max(r, i)); };

  // Put the cursor in the first blank of each new stop (not on first load, so phones don't pop the keyboard).
  const stage = useRef(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    stage.current?.querySelector('[data-blank]')?.focus({ preventScroll: true });
  }, [step, mode]);

  // Enter moves to the next blank; on the last blank of a stop it drives on to the next stop.
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || !e.target.matches('[data-blank]')) return;
    const blanks = [...stage.current.querySelectorAll('[data-blank]')];
    const nextBlank = blanks[blanks.indexOf(e.target) + 1];
    e.preventDefault();
    if (nextBlank) nextBlank.focus(); else e.currentTarget.requestSubmit();
  };
  const submit = async (e) => {
    e.preventDefault();
    if (mode === 'email') {
      setBusy(true); setErr('');
      try { await emailLink(email); setSent(true); } catch (x) { setErr(x.message || 'Could not send the link'); }
      setBusy(false); return;
    }
    if (step < last) { if (valid[step]) go(step + 1); return; }
    setBusy(true); setErr(''); setStamped(true);
    await new Promise((r) => setTimeout(r, 700));
    try { await onLogin(f); } catch (x) { setStamped(false); setErr(x.message || 'Could not sign in'); setBusy(false); }
  };
  const fixStep = /team code|access code/i.test(err) ? 1 : /email/i.test(err) ? 2 : null;

  const stop = stops[step];
  const roleLabel = ROLES.find(([v]) => v === f.role)[1];
  const rows = hacker
    ? [['Name', f.name, 0], ['Team', f.team, 1], ['Email', f.email, 2], ...(f.phone ? [['Phone', f.phone, 2]] : []),
      ['From', f.organisation, 3], ...(f.skills ? [['Brings', f.skills, 3]] : []), ['Why', f.motivation, 4]]
    : [['Joining as', roleLabel, 0], ['Team', f.team, 1]];

  return (
    <form className="route" onSubmit={submit} onKeyDown={onKeyDown} noValidate={mode === 'join' && step === last}>
      <div className="routeBg" aria-hidden="true">
        {ROUTE.map((r) => {
          const active = r === (mode === 'email' ? ROUTE[5] : stop);
          // Only fetch the photos you can see or are about to drive to.
          const load = active || stops.indexOf(r) <= reached + 1 && stops.includes(r);
          return <div key={r.img} className={active ? 'on' : ''} style={load ? { backgroundImage: `url(${routePhoto(r)})` } : undefined} />;
        })}
      </div>

      <div className="routeTop">
        {onHome ? <button type="button" className="routeHome" onClick={onHome} aria-label="Back to the website"><Icon d={I.arrowLeft} size={18} /><Logo small /></button> : <Logo small />}
        <button type="button" className="routeSwitch" onClick={() => { setMode(mode === 'join' ? 'email' : 'join'); setErr(''); setSent(false); }}>
          <Icon d={mode === 'join' ? I.key : I.arrowLeft} size={16} />
          <span>{mode === 'join' ? <><span className="wideOnly">Saved your account? </span><b>Sign in</b></> : 'Back to sign-up'}</span>
        </button>
      </div>

      <div className="routeMain">
        {mode === 'email' ? (
          <div className="routeStage" ref={stage} key="email">
            <span className="stopTag">Welcome back</span>
            <p className="big">Send a sign-in link to <Blank required type="email" aria-label="Email you saved to your account" placeholder="your saved email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />.</p>
            {sent && <p className="routeHint" role="status">Done. Check your inbox for the sign-in link.</p>}
            {err && <p className="routeErr" role="alert">{err}</p>}
            <div className="routeNav">
              <button className="goBtn" disabled={busy || !EMAIL_RE.test(email.trim())}>
                <span className="goText"><small>Welcome back</small><b>{busy ? 'Sending…' : 'Email me a link'}</b></span>
                <span className="goIcon" aria-hidden="true"><Icon d={I.mail} size={20} /></span>
              </button>
            </div>
          </div>
        ) : (
          <div className="routeStage" ref={stage} key={step}>
            <span className="stopTag">{staff ? 'Staff entrance · ' : ''}Stop {step + 1} of {stops.length}</span>
            <p className="stopPlace">{stop.place}</p>
            <p className="stopFact">{stop.fact}</p>

            {step === 0 && (staff ? (
              <p className="big">
                Sawubona! My name is <Blank required maxLength={80} aria-label="Your name" placeholder="your name" value={f.name} onChange={set('name')} autoComplete="name" />
                {' '}and I'm here as{' '}
                <span className="blankWrap" data-value={`${roleLabel} ▾`}>
                  <select data-blank className="blank" aria-label="Your role" value={f.role} onChange={set('role')}>
                    {ROLES.filter(([v]) => v !== 'Hackers').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </span>.
              </p>
            ) : (
              <p className="big">
                Sawubona! My name is <Blank required maxLength={80} aria-label="Your name" placeholder="your name" value={f.name} onChange={set('name')} autoComplete="name" />,
                and I want a seat at the hackathon.
              </p>
            ))}
            {step === 1 && (hacker ? <>
              <p className="big">
                My crew is called <Blank required maxLength={60} aria-label="Team name" placeholder="team name" value={f.team} onChange={set('team')} />,
                and our secret password is <Blank required type="password" minLength={4} aria-label="Team code, at least 4 characters" placeholder="4+ characters" value={f.teamCode} onChange={set('teamCode')} />.
              </p>
              <p className="routeHint">New team? Make one up and share it with your crew. Joining one? Ask a teammate for it.</p>
            </> : (
              <p className="big">
                I'm with <Blank required maxLength={60} aria-label="Team or group" placeholder="your group" value={f.team} onChange={set('team')} />,
                and my access code is <Blank required type="password" aria-label="Access code" placeholder="from the organisers" value={f.code} onChange={set('code')} />.
              </p>
            ))}
            {hacker && step === 2 && (
              <p className="big">
                Drop me a line at <Blank required type="email" maxLength={200} aria-label="Email" placeholder="your email" value={f.email} onChange={set('email')} autoComplete="email" />
                {' '}or call me on <Blank type="tel" maxLength={30} aria-label="Phone (optional)" placeholder="phone (optional)" value={f.phone} onChange={set('phone')} autoComplete="tel" />.
              </p>
            )}
            {hacker && step === 3 && (
              <p className="big">
                I'm from <Blank required maxLength={200} aria-label="School, university or organisation" placeholder="school or organisation" value={f.organisation} onChange={set('organisation')} />,
                and I bring <Blank maxLength={500} aria-label="Skills (optional)" placeholder="skills (optional)" value={f.skills} onChange={set('skills')} /> to the table.
              </p>
            )}
            {hacker && step === 4 && <>
              <p className="big lead">From up here, this is why I want in:</p>
              <div className="postcard">
                <small>Postcard to the organisers</small>
                <textarea data-blank required rows={5} maxLength={1000} aria-label="Why do you want to take part?" placeholder="Dear organisers…" value={f.motivation} onChange={set('motivation')} />
              </div>
            </>}
            {step === last && <>
              <p className="big lead">{hacker ? 'Your Panorama Pass is ready.' : 'Welcome aboard.'}</p>
              <div className={`pass ${stamped ? 'stamped' : ''}`}>
                <div className="passHead">
                  <div><small>Panorama Pass · Hackathon 2026</small><br /><b>{f.name}</b></div>
                  <small>Admit one</small>
                </div>
                <div className="passRows">
                  {rows.map(([label, value, at]) => (
                    <div key={label} className="passRow">
                      <small>{label}</small>
                      <span className={label === 'Why' ? 'quote' : ''}>{label === 'Why' ? `“${value}”` : value}</span>
                      <button type="button" onClick={() => go(at)} aria-label={`Edit ${label}`}>Edit</button>
                    </div>
                  ))}
                </div>
                <div className="stamp" aria-hidden="true">{hacker ? <>APPLIED<br />✓</> : <>ADMIT<br />✓</>}</div>
              </div>
            </>}

            {err && <p className="routeErr" role="alert">{err}{fixStep != null && fixStep <= last && <> · <button type="button" className="linkInline" onClick={() => go(fixStep)}>Fix it</button></>}</p>}
            <div className="routeNav">
              {step > 0 && <button type="button" className="backBtn" onClick={() => go(step - 1)} aria-label={`Back to ${stops[step - 1].place}`}><Icon d={I.arrowLeft} size={22} /></button>}
              <button className={`goBtn ${step === last ? 'final' : ''}`} disabled={busy || !valid[step]}>
                <span className="goText">
                  {busy ? <b>Sending…</b>
                    : step < last ? <><small>Next stop</small><b>{stops[step + 1].place}</b></>
                      : <><small>{hacker ? 'Last step' : 'All set'}</small><b>{hacker ? 'Stamp it & send' : 'Let me in'}</b></>}
                </span>
                <span className="goIcon" aria-hidden="true"><Icon d={step === last ? I.stamp : I.arrowRight} size={20} /></span>
              </button>
              {step < last && <span className="routeKey">or press <kbd>Enter ↵</kbd></span>}
            </div>
            {(step === 0 || step === last) && (
              <p className="routeFine">{hacker ? 'Organisers review every application and can see your email and phone number. ' : ''}Your name, team and messages are shared with other participants. See Settings &gt; Privacy after signing in.</p>
            )}
          </div>
        )}
      </div>

      {mode === 'join' && <RouteMap stops={stops} here={step} reached={reached} go={go} />}
    </form>
  );
}

// Public website shown to signed-out visitors. "Apply now" opens the application (#apply);
// once an organiser accepts someone, the same address opens the Hub app for them.
const HOW = [
  ['Apply', 'Tell us who you are and what you want to build. It takes about two minutes.'],
  ['Get accepted', 'The organisers review every application. Come back here to see their decision.'],
  ['Open the Hub', 'Once you are in, this site becomes your event app: team chat, announcements, the programme and the countdown.'],
  ['Build & pitch', 'Pick a challenge, build with your team and submit before code freeze. Judges score impact, innovation, tech and pitch.'],
];
const HUB = [
  ['chat', 'Team chat', 'Your own team channel, plus general chat and a line to the mentors.'],
  ['mega', 'Announcements', 'Official updates from the organisers, the moment they post them.'],
  ['clock', 'Code-freeze countdown', 'One clock for every team, with a reminder before time runs out.'],
  ['cal', 'Programme', 'Every session, meal and deadline, day by day.'],
  ['upload', 'Submissions', 'Send your demo, repo and slides, and update them until code freeze.'],
  ['trophy', 'Judging', 'Judges score every project in the app, so results are ready on time.'],
];
const SITE_FAQS = [
  ['How do I get in?', 'Apply on this site. The organisers review every application, and once you are accepted this site opens the Hackathon Hub app for you.'],
  ['Do I need a team to apply?', 'No. Enter a new team name and make up a team code, or join friends by using their team name and code.'],
  ...faqs.filter(([q]) => q !== 'Who can take part?'),
];

// Hero headline: "Code the <stop>", with a caption for each stop.
const HERO_STOPS = [
  ['Panorama Route.', 'The R532, from Graskop past the waterfalls to the Blyde River Canyon.'],
  ['Big Five.', 'All five are out on the plain below. Look closely.'],
  ['Blyde River Canyon.', 'One of the largest green canyons on Earth.'],
  ["God's Window.", 'A sheer drop from the escarpment to the Lowveld, when the mist allows.'],
  ['road ahead.', 'Four challenges from the people who run tourism here.'],
];

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Adds .in to [data-reveal] elements the first time they scroll into view.
function useReveal(root) {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    root.current.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
}

// Counts up from 0 the first time it scrolls into view.
function CountUp({ to }) {
  const ref = useRef(null);
  const [n, setN] = useState(to);
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    setN(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - start) / 1300);
        setN(Math.round(to * (1 - (1 - k) ** 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <b ref={ref}>{n}</b>;
}

// Challenge cards lean towards the pointer, with a soft highlight where it is.
const tilt = (e) => {
  const el = e.currentTarget, r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  el.style.setProperty('--rx', `${(0.5 - y) * 9}deg`); el.style.setProperty('--ry', `${(x - 0.5) * 11}deg`);
  el.style.setProperty('--mx', `${x * 100}%`); el.style.setProperty('--my', `${y * 100}%`);
};
const untilt = (e) => { e.currentTarget.style.setProperty('--rx', '0deg'); e.currentTarget.style.setProperty('--ry', '0deg'); };

// The low-poly 3D Mpumalanga behind the hero (dusk) and the closing section (night).
function WorldCanvas({ night = false }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stop = () => {}, alive = true;
    startWorld(ref.current, { night, reduced: prefersReducedMotion() })
      .then((s) => { if (alive) { stop = s; setReady(true); } else s(); })
      .catch(() => {}); // no WebGL: the painted gradient behind the canvas stays
    return () => { alive = false; stop(); };
  }, [night]);
  return <canvas ref={ref} className={`world${ready ? ' ready' : ''}`} aria-hidden="true" />;
}

// A small live copy of the app's home screen for the "Hub" section.
function PhoneMock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.floor((86400000 - (now % 86400000)) / 1000); // ticks down to midnight, just for show
  const tiles = [['chat', '#22b573', 'Team Chat'], ['mega', '#f5a623', 'Updates'], ['bulb', '#7c5cff', 'Challenges'], ['cal', '#17b8a6', 'Programme'], ['team', '#eb4d6b', 'Mentors'], ['upload', '#2f80ed', 'Submit']];
  return (
    <div className="phoneMock" aria-hidden="true">
      <div className="pmScreen">
        <div className="pmHero"><Logo small /><b>Tourism Mpumalanga<br />Hackathon Hub</b></div>
        <div className="pmTimer">
          <small>Time remaining until code freeze</small>
          <div>{[Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60].map((v, i) => <span key={i}>{pad(v)}</span>)}</div>
        </div>
        <div className="pmTiles">{tiles.map(([ic, c, l]) => <span key={l}><i style={{ background: `${c}22`, color: c }}><Icon d={I[ic]} size={15} /></i>{l}</span>)}</div>
        <div className="pmNav"><i /><i /><i /><i /></div>
      </div>
    </div>
  );
}

function Landing({ apply, signIn }) {
  const root = useRef(null);
  const nav = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [stop, setStop] = useState(0);
  useReveal(root);
  // The headline's last word cycles through stops on the route; the corner caption narrates each one.
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const t = setInterval(() => setStop((n) => (n + 1) % HERO_STOPS.length), 3400);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      nav.current?.style.setProperty('--p', max > 0 ? String(window.scrollY / max) : '0');
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const ApplyBtn = ({ label = 'Applications open' }) => (
    <button type="button" className="goBtn" onClick={apply}>
      <span className="goText"><small>{label}</small><b>Apply now</b></span>
      <span className="goIcon" aria-hidden="true"><Icon d={I.arrowRight} size={20} /></span>
    </button>
  );
  return (
    <div className="site" ref={root}>
      <header ref={nav} className={`siteNav ${scrolled ? 'solid' : ''}`}>
        <a href="#top" aria-label={`${event.name}, back to top`}><Logo small /></a>
        <nav className="siteLinks" aria-label="Sections">
          <a href="#about">How it works</a><a href="#challenges">Challenges</a><a href="#programme">Programme</a><a href="#faq">FAQ</a>
        </nav>
        <div className="siteActions">
          <button type="button" className="siteGhost" onClick={signIn}>Sign in</button>
          <button type="button" className="sitePill" onClick={apply}>Apply now</button>
        </div>
        <i className="siteProgress" aria-hidden="true" />
      </header>

      <main>
        <section className="siteHero" id="top">
          <WorldCanvas />
          <div className="heroShade" aria-hidden="true" />
          <div className="siteHeroInner">
            <p className="heroMeta">
              <span className="routeShield" title="The R532, the Panorama Route">R532</span>
              <span>{event.dates}</span><i /><span>{event.place}</span><i /><span className="coords">24°52′S 30°53′E</span>
            </p>
            <h1 aria-label="Code the Panorama Route.">
              <span className="w" style={{ '--d': 0 }}>Code</span> <span className="w" style={{ '--d': 1 }}>the</span><br />
              <em className="w" style={{ '--d': 2 }}>
                <span className="rotator" aria-hidden="true">
                  {HERO_STOPS.map(([word], k) => <span key={word} className={k === stop ? 'on' : k === (stop + HERO_STOPS.length - 1) % HERO_STOPS.length ? 'off' : ''}>{word}</span>)}
                </span>
              </em>
              <svg className="routeLine" key={stop} viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 C 90 2, 180 11, 270 5 S 370 4, 398 7" /></svg>
            </h1>
            <p className="siteLead">
              <b>{days.length * 24} hours.</b> <b>{challenges.length} real briefs</b> from the people who run tourism here. One question: what would make a trip along this road easier to plan, safer to drive and open to everyone? Come build the answer.
            </p>
            <div className="siteCtas">
              <ApplyBtn />
              <a className="siteGhost big" href="#challenges">See the challenges</a>
            </div>
          </div>
          <p className="sceneNote" aria-live="off">
            <span className="noteKey" key={stop}><small>{String(stop + 1).padStart(2, '0')} / {String(HERO_STOPS.length).padStart(2, '0')}</small>{HERO_STOPS[stop][1]}</span>
          </p>
        </section>

        <div className="marquee" aria-hidden="true">
          <div>{[0, 1].map((k) => <span key={k}>Innovate <i>·</i> Collaborate <i>·</i> Transform tourism <i>·</i> Sawubona <i>·</i> Code the Panorama Route <i>·</i>&nbsp;</span>)}</div>
        </div>

        <section className="paperBg">
          <div className="siteSection" id="about">
            <div className="aboutGrid">
              <div>
                <p className="siteEyebrow" data-reveal>How it works</p>
                <h2 data-reveal>From application to awards in four stops.</h2>
              </div>
              <dl className="statsRow">
                <div data-reveal><dt>Days of building</dt><dd><CountUp to={days.length} /></dd></div>
                <div data-reveal style={{ '--delay': '.08s' }}><dt>Tourism challenges</dt><dd><CountUp to={challenges.length} /></dd></div>
                <div data-reveal style={{ '--delay': '.16s' }}><dt>App for the whole event</dt><dd><b>1</b></dd></div>
              </dl>
            </div>
            <ol className="siteSteps">
              {HOW.map(([title, body], i) => (
                <li key={title} data-reveal style={{ '--delay': `${i * 0.12}s` }}><span>{String(i + 1).padStart(2, '0')}</span><b>{title}</b><p>{body}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="forestBg">
          <div className="siteSection" id="challenges">
            <p className="siteEyebrow" data-reveal>The challenges</p>
            <h2 data-reveal>Real problems from the tourism industry.</h2>
            <div className="siteCards">
              {challenges.map((c, i) => (
                <article key={c.id} className="siteCard" data-reveal style={{ backgroundImage: `url(${c.img})`, '--delay': `${i * 0.1}s` }} onMouseMove={tilt} onMouseLeave={untilt}>
                  <div>
                    <span>Challenge {String(c.id).padStart(2, '0')}</span>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="boneBg">
          <div className="siteSection" id="programme">
            <p className="siteEyebrow" data-reveal>Programme</p>
            <h2 data-reveal>{days.length} days on the hack floor.</h2>
            <div className="siteDays">
              {days.map(([d, w], i) => (
                <div key={d} className="siteDay" data-reveal style={{ '--delay': `${i * 0.12}s` }}>
                  <small>Day {i + 1}</small>
                  <h3>{w}, {d}</h3>
                  <ul>
                    {(programme[d] || []).map(([time, title, where]) => (
                      <li key={time + title}><b>{time}</b><span>{title}<small>{where}</small></span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="siteHub">
          <div className="siteSection hubGrid">
            <div>
              <p className="siteEyebrow" data-reveal>Once you're in</p>
              <h2 data-reveal>Everything happens in the Hub.</h2>
              <div className="siteFeatures">
                {HUB.map(([ic, title, body], i) => (
                  <div key={title} data-reveal style={{ '--delay': `${i * 0.07}s` }}><span><Icon d={I[ic]} size={20} /></span><b>{title}</b><p>{body}</p></div>
                ))}
              </div>
            </div>
            <div data-reveal className="mockWrap"><PhoneMock /></div>
          </div>
        </section>

        <section className="paperBg">
          <div className="siteSection narrow" id="faq">
            <p className="siteEyebrow" data-reveal>FAQ</p>
            <h2 data-reveal>Good to know.</h2>
            {SITE_FAQS.map(([q, a], i) => (
              <details key={q} className="siteFaq" data-reveal open={i === 0}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="siteNight">
          <WorldCanvas night />
          <div className="nightShade" aria-hidden="true" />
          <div className="nightInner" data-reveal>
            <p className="siteEyebrow">Applications are open</p>
            <h2>Your seat on the Panorama Route is <em>waiting.</em></h2>
            <ApplyBtn label="Takes two minutes" />
          </div>
        </section>
      </main>

      <footer className="siteFoot">
        <div><Logo small /><p>{event.name} · {event.dates}</p></div>
        <details>
          <summary>Photo credits</summary>
          {credits.map((c) => (
            <p key={c.file}><a href={c.url} target="_blank" rel="noreferrer">{c.title.replace(/\.jpg$/, '')}</a> by {c.author}, {c.license}, via Wikimedia Commons</p>
          ))}
        </details>
      </footer>
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
    <div className="screen auth">
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
              <div className="reviewBtns">
                {p.status !== 'approved' && <button className="btn small" onClick={() => decide(p, 'approved')}>Approve</button>}
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

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function Authed() {
  const { ready, profile, join, logout, emailLink, refresh } = useAuth();
  const hash = useHash();
  const goTo = (h) => { window.location.hash = h; window.scrollTo(0, 0); };
  const frame = (child) => <div className="phoneWrap"><div className="phone"><div className="status"><span>9:41</span><span>●●● ▮</span></div><div className="body">{child}</div></div></div>;
  if (!ready) return frame(<p className="empty">Loading…</p>);
  if (!profile) {
    if (STAFF) return frame(<Login onLogin={join} emailLink={emailLink} staff />);
    if (hash === '#apply' || hash === '#signin') {
      return frame(<Login key={hash} onLogin={join} emailLink={emailLink} initialMode={hash === '#signin' ? 'email' : 'join'} onHome={() => goTo('top')} />);
    }
    return <Landing apply={() => goTo('apply')} signIn={() => goTo('signin')} />;
  }
  if (profile.status !== 'approved') return frame(<ApplicationStatus user={profile} refresh={refresh} />);
  return <Main user={profile} logout={logout} />;
}

function Main({ user, logout }) {
  // Organisers who come in through the staff entrance start on the applications list.
  const [stack, setStack] = useState(() => (STAFF && user.role === 'Organiser' ? ['home', 'applications'] : ['home']));
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
          {screen === 'home' && <Home go={go} deadline={deadline} unread={unreadTotal} isOrganiser={isOrganiser} pending={pendingCount} />}
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
