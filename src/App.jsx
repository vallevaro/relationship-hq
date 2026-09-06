import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Heart,
  LogOut,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

const CATEGORIES = ["Restaurant", "Cinema", "Travel", "Outdoor", "Home", "Culture", "Other"];
const EXIT_GIF = import.meta.env.VITE_EXIT_GIF_URL || "";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function ratingClass(r) {
  if (r >= 9) return "excellent";
  if (r >= 7) return "good";
  if (r >= 5) return "okay";
  return "danger";
}

function emptyForm(date = todayISO()) {
  return {
    date_on: date,
    title: "",
    location: "",
    category: "Other",
    overall_rating: 8,
    food_rating: 8,
    activity_rating: 8,
    romance_rating: 8,
    thoughts: "",
    funny_moment: ""
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [dates, setDates] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadData();
    else setLoading(false);
  }, [session]);

  async function loadData() {
    setLoading(true);
    const { data: dateRows, error } = await supabase
      .from("dates")
      .select("*")
      .order("date_on", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setDates(dateRows || []);
    const { data: photoRows } = await supabase
      .from("date_photos")
      .select("*")
      .order("created_at", { ascending: false });
    setPhotos(photoRows || []);
    setLoading(false);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthBusy(true);
    setMessage("");

    const result = authMode === "signin"
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      : await supabase.auth.signUp({ email: authEmail, password: authPassword });

    if (result.error) setMessage(result.error.message);
    else if (authMode === "signup") setMessage("Account created. Check your email if confirmation is enabled.");
    setAuthBusy(false);
  }

  async function saveDate(e) {
    e.preventDefault();
    const payload = {
      ...form,
      overall_rating: Number(form.overall_rating),
      food_rating: Number(form.food_rating),
      activity_rating: Number(form.activity_rating),
      romance_rating: Number(form.romance_rating),
      created_by: session.user.id
    };

    const { data, error } = await supabase.from("dates").insert(payload).select().single();
    if (error) {
      setMessage(error.message);
      return;
    }
    setDates(prev => [data, ...prev]);
    setSelectedDate(data);
    setShowForm(false);
    setForm(emptyForm());
    setView("date");
    setMessage("Date archived successfully.");
  }

  async function deleteDate(id) {
    if (!window.confirm("Delete this date from the official relationship records?")) return;
    const { error } = await supabase.from("dates").delete().eq("id", id);
    if (error) setMessage(error.message);
    else {
      setDates(prev => prev.filter(d => d.id !== id));
      setPhotos(prev => prev.filter(p => p.date_id !== id));
      setSelectedDate(null);
      setView("dashboard");
    }
  }

  async function uploadPhotos(filesToUpload) {
    if (!selectedDate || !filesToUpload?.length) return;
    setMessage("Uploading photos…");

    for (const file of Array.from(filesToUpload)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${session.user.id}/${selectedDate.id}/${crypto.randomUUID()}-${safe}`;

      const { error: uploadError } = await supabase.storage
        .from("date-photos")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }

      const { data: row, error: rowError } = await supabase
        .from("date_photos")
        .insert({
          date_id: selectedDate.id,
          storage_path: path,
          uploaded_by: session.user.id,
          caption: ""
        })
        .select()
        .single();

      if (!rowError) setPhotos(prev => [row, ...prev]);
    }

    setMessage("Photos archived.");
  }

  async function photoUrl(path) {
    const { data } = await supabase.storage.from("date-photos").createSignedUrl(path, 3600);
    return data?.signedUrl;
  }

  async function openDate(date) {
    setSelectedDate(date);
    setView("date");
    const datePhotos = photos.filter(p => p.date_id === date.id);
    const withUrls = await Promise.all(
      datePhotos.map(async p => ({ ...p, url: await photoUrl(p.storage_path) }))
    );
    setPhotos(prev => prev.map(p => {
      const found = withUrls.find(x => x.id === p.id);
      return found || p;
    }));
  }

  async function signOut() {
    await supabase.auth.signOut();
    setDates([]);
    setPhotos([]);
  }

  const stats = useMemo(() => {
    if (!dates.length) return { avg: 0, count: 0, best: null, gap: null };
    const avg = dates.reduce((sum, d) => sum + Number(d.overall_rating), 0) / dates.length;
    const best = [...dates].sort((a, b) => b.overall_rating - a.overall_rating)[0];
    const sorted = [...dates].sort((a, b) => new Date(a.date_on) - new Date(b.date_on));
    const gap = sorted.length > 1
      ? Math.round((new Date(sorted.at(-1).date_on) - new Date(sorted.at(-2).date_on)) / 86400000)
      : null;
    return { avg, count: dates.length, best, gap };
  }, [dates]);

  if (!isSupabaseConfigured) return <SetupScreen />;

  if (!session) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        email={authEmail}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        busy={authBusy}
        onSubmit={handleAuth}
        message={message}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => setView("dashboard")}>
          <div className="brand-mark"><Heart size={19} fill="currentColor" /></div>
          <div>
            <strong>Relationship Management System™</strong>
            <span>Official archive of questionable decisions</span>
          </div>
        </div>

        <nav>
          <button className={view === "dashboard" ? "nav-active" : ""} onClick={() => setView("dashboard")}><BarChart3 size={17}/> Dashboard</button>
          <button className={view === "calendar" ? "nav-active" : ""} onClick={() => setView("calendar")}><CalendarDays size={17}/> Calendar</button>
          <button className={view === "stats" ? "nav-active" : ""} onClick={() => setView("stats")}><Sparkles size={17}/> Intelligence</button>
          <button className="exit-nav" onClick={() => setExitOpen(true)}><ShieldAlert size={17}/> Exit relationship</button>
        </nav>

        <button className="icon-button" title="Sign out" onClick={signOut}><LogOut size={18}/></button>
      </header>

      {message && <div className="toast" onClick={() => setMessage("")}>{message}<X size={15}/></div>}

      <main className="page">
        {loading ? <div className="loading">Loading relationship records…</div> : null}

        {!loading && view === "dashboard" && (
          <Dashboard
            dates={dates}
            stats={stats}
            onNew={() => { setForm(emptyForm()); setShowForm(true); }}
            onOpen={openDate}
          />
        )}

        {!loading && view === "calendar" && (
          <CalendarView dates={dates} onOpen={openDate} />
        )}

        {!loading && view === "stats" && (
          <StatsView dates={dates} stats={stats} />
        )}

        {!loading && view === "date" && selectedDate && (
          <DateView
            date={selectedDate}
            photos={photos.filter(p => p.date_id === selectedDate.id)}
            onBack={() => setView("dashboard")}
            onUpload={uploadPhotos}
            onDelete={() => deleteDate(selectedDate.id)}
          />
        )}
      </main>

      {showForm && (
        <DateForm
          form={form}
          setForm={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={saveDate}
        />
      )}

      {exitOpen && <ExitModal onClose={() => setExitOpen(false)} />}
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="center-screen">
      <div className="setup-card">
        <div className="brand-mark large"><Heart size={26} fill="currentColor" /></div>
        <h1>Relationship Management System™</h1>
        <p>The frontend is ready. Add your Supabase environment variables to connect the relationship database.</p>
        <pre>{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY`}</pre>
        <p className="muted">See README.md for the complete setup.</p>
      </div>
    </div>
  );
}

function AuthScreen({ mode, setMode, email, setEmail, password, setPassword, busy, onSubmit, message }) {
  return (
    <div className="center-screen">
      <div className="auth-card">
        <div className="brand-mark large"><Heart size={26} fill="currentColor" /></div>
        <div className="eyebrow">RESTRICTED ACCESS</div>
        <h1>Relationship HQ</h1>
        <p>Authorized personnel only. Two people. One questionable database.</p>
        <form onSubmit={onSubmit}>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength="6" required /></label>
          <button className="primary wide" disabled={busy}>{busy ? "Processing…" : mode === "signin" ? "Enter HQ" : "Create account"}</button>
        </form>
        {message && <div className="form-message">{message}</div>}
        <button className="text-button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account?" : "Already have an account?"}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ dates, stats, onNew, onOpen }) {
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">RELATIONSHIP PERFORMANCE DASHBOARD</div>
          <h1>Operationally excellent.<br/><em>Statistically questionable.</em></h1>
          <p>Keep the memories. Track the dates. Produce completely unnecessary analytics.</p>
        </div>
        <button className="primary" onClick={onNew}><Plus size={18}/> Log a date</button>
      </section>

      <section className="metric-grid">
        <Metric label="Average satisfaction" value={stats.count ? `${stats.avg.toFixed(1)}/10` : "—"} note={stats.count ? "Current relationship index" : "No data yet"} />
        <Metric label="Dates archived" value={stats.count} note="Evidence collected" />
        <Metric label="Best reviewed date" value={stats.best ? `${Number(stats.best.overall_rating).toFixed(1)}` : "—"} note={stats.best?.title || "Awaiting evidence"} />
        <Metric label="Days since previous date" value={stats.gap ?? "—"} note={stats.gap !== null ? "Please schedule another one" : "Need two dates"} />
      </section>

      <section className="section-heading">
        <div><div className="eyebrow">RECENT RECORDS</div><h2>Date archive</h2></div>
        <span>{dates.length} total</span>
      </section>

      {dates.length === 0 ? (
        <EmptyState onNew={onNew}/>
      ) : (
        <div className="date-grid">
          {dates.slice(0, 8).map(date => <DateCard key={date.id} date={date} onClick={() => onOpen(date)} />)}
        </div>
      )}
    </>
  );
}

function Metric({ label, value, note }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function DateCard({ date, onClick }) {
  return (
    <button className="date-card" onClick={onClick}>
      <div className="date-card-top">
        <span className="date-pill">{new Date(date.date_on).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</span>
        <span className={`score ${ratingClass(Number(date.overall_rating))}`}>{Number(date.overall_rating).toFixed(1)}</span>
      </div>
      <h3>{date.title}</h3>
      <p>{date.location || "Location classified"}</p>
      <span className="category">{date.category}</span>
    </button>
  );
}

function EmptyState({ onNew }) {
  return <div className="empty"><CalendarDays size={34}/><h3>The archive is suspiciously empty.</h3><p>Your first date is waiting to become a data point.</p><button className="primary" onClick={onNew}>Log the first date</button></div>;
}

function DateForm({ form, setForm, onClose, onSubmit }) {
  const field = (key, value) => setForm(f => ({ ...f, [key]: value }));
  return (
    <div className="modal-backdrop">
      <div className="modal large-modal">
        <div className="modal-head"><div><div className="eyebrow">NEW RECORD</div><h2>Log a date</h2></div><button className="icon-button" onClick={onClose}><X/></button></div>
        <form onSubmit={onSubmit} className="date-form">
          <div className="form-grid">
            <label>Date<input type="date" value={form.date_on} onChange={e => field("date_on", e.target.value)} required /></label>
            <label>Title<input placeholder="e.g. Sushi + cinema" value={form.title} onChange={e => field("title", e.target.value)} required /></label>
            <label>Location<input placeholder="Optional" value={form.location} onChange={e => field("location", e.target.value)} /></label>
            <label>Category<select value={form.category} onChange={e => field("category", e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
          </div>

          <div className="ratings-box">
            <div className="eyebrow">PERFORMANCE REVIEW</div>
            <RatingInput label="Overall satisfaction" value={form.overall_rating} onChange={v => field("overall_rating", v)} />
            <RatingInput label="Food" value={form.food_rating} onChange={v => field("food_rating", v)} />
            <RatingInput label="Activity" value={form.activity_rating} onChange={v => field("activity_rating", v)} />
            <RatingInput label="Romance" value={form.romance_rating} onChange={v => field("romance_rating", v)} />
          </div>

          <label>Thoughts<textarea rows="4" placeholder="What did you think?" value={form.thoughts} onChange={e => field("thoughts", e.target.value)} /></label>
          <label>Funny moment<textarea rows="3" placeholder="Document the incident." value={form.funny_moment} onChange={e => field("funny_moment", e.target.value)} /></label>

          <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary"><Save size={17}/> Archive date</button></div>
        </form>
      </div>
    </div>
  );
}

function RatingInput({ label, value, onChange }) {
  return <label className="rating-row"><span>{label}</span><input type="range" min="0" max="10" step="0.5" value={value} onChange={e => onChange(Number(e.target.value))}/><strong>{Number(value).toFixed(1)}</strong></label>;
}

function DateView({ date, photos, onBack, onUpload, onDelete }) {
  return (
    <>
      <button className="back-button" onClick={onBack}><ChevronLeft size={17}/> Back to archive</button>
      <section className="detail-head">
        <div>
          <div className="eyebrow">{new Date(date.date_on).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
          <h1>{date.title}</h1>
          <p>{date.location || "Location classified"} · {date.category}</p>
        </div>
        <div className={`big-score ${ratingClass(Number(date.overall_rating))}`}><Star size={22} fill="currentColor"/>{Number(date.overall_rating).toFixed(1)}<small>/10</small></div>
      </section>

      <section className="detail-grid">
        <div className="paper">
          <div className="eyebrow">THOUGHTS</div>
          <p className="thoughts">{date.thoughts || "No thoughts were filed."}</p>
          {date.funny_moment && <div className="funny-note"><Sparkles size={17}/><div><strong>Incident report</strong><p>{date.funny_moment}</p></div></div>}
        </div>
        <div className="paper">
          <div className="eyebrow">SUB-SCORES</div>
          <MiniScore label="Food" value={date.food_rating}/>
          <MiniScore label="Activity" value={date.activity_rating}/>
          <MiniScore label="Romance" value={date.romance_rating}/>
        </div>
      </section>

      <section className="photos-section">
        <div className="section-heading"><div><div className="eyebrow">MEMORY ARCHIVE</div><h2>Photos</h2></div>
          <label className="secondary upload-button"><Upload size={17}/> Add photos<input type="file" accept="image/*" multiple onChange={e => onUpload(e.target.files)}/></label>
        </div>
        {photos.length ? <div className="photo-grid">{photos.map(p => p.url ? <img key={p.id} src={p.url} alt={p.caption || "Date memory"} /> : <div key={p.id} className="photo-placeholder"><Camera/></div>)}</div> : <div className="photo-empty"><Camera size={28}/><p>No photographic evidence yet.</p></div>}
      </section>

      <div className="danger-zone"><button className="danger-button" onClick={onDelete}><Trash2 size={16}/> Delete this record</button></div>
    </>
  );
}

function MiniScore({ label, value }) {
  return <div className="mini-score"><span>{label}</span><div><div className="progress"><i style={{width: `${Number(value || 0) * 10}%`}} /></div><strong>{value ?? "—"}</strong></div></div>;
}

function CalendarView({ dates, onOpen }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    return day > 0 && day <= days ? new Date(year, month, day) : null;
  });
  const map = new Map(dates.map(d => [d.date_on, d]));

  return (
    <>
      <section className="section-heading"><div><div className="eyebrow">SCHEDULE</div><h1>Date calendar</h1></div>
        <div className="calendar-nav"><button className="icon-button" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft/></button><strong>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong><button className="icon-button" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight/></button></div>
      </section>
      <div className="calendar">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div className="weekday" key={d}>{d}</div>)}
        {cells.map((day, i) => {
          const record = day && map.get(day.toISOString().slice(0,10));
          return <div className={`cal-cell ${!day ? "blank" : ""}`} key={i}>
            {day && <><span className="day-number">{day.getDate()}</span>{record && <button className={`calendar-event ${ratingClass(Number(record.overall_rating))}`} onClick={() => onOpen(record)}><strong>{record.title}</strong><span>{Number(record.overall_rating).toFixed(1)}/10</span></button>}</>}
          </div>
        })}
      </div>
    </>
  );
}

function StatsView({ dates, stats }) {
  const categories = CATEGORIES.map(c => {
    const rows = dates.filter(d => d.category === c);
    return { c, avg: rows.length ? rows.reduce((s, d) => s + Number(d.overall_rating), 0) / rows.length : 0, n: rows.length };
  }).filter(x => x.n);

  return (
    <>
      <section className="hero compact"><div><div className="eyebrow">RELATIONSHIP INTELLIGENCE</div><h1>Completely unnecessary analytics.</h1><p>Because apparently memories need a performance dashboard.</p></div></section>
      <section className="metric-grid"><Metric label="Mean satisfaction" value={stats.count ? stats.avg.toFixed(2) : "—"} note="Arithmetic is romance" /><Metric label="Total dates" value={stats.count} note="Sample size: acceptable" /><Metric label="Top date" value={stats.best ? `${stats.best.overall_rating}/10` : "—"} note={stats.best?.title || "No winner yet"} /><Metric label="Relationship status" value="ACTIVE" note="Management approved" /></section>
      <div className="paper stats-paper">
        <div className="eyebrow">CATEGORY PERFORMANCE</div><h2>Where are we strongest?</h2>
        {categories.length ? categories.map(x => <div className="bar-row" key={x.c}><span>{x.c}</span><div className="progress"><i style={{width: `${x.avg * 10}%`}} /></div><strong>{x.avg.toFixed(1)}</strong></div>) : <p>No category data yet.</p>}
      </div>
      <div className="paper intelligence">
        <Sparkles size={22}/><div><strong>Management recommendation</strong><p>{stats.gap !== null && stats.gap > 14 ? "Schedule another date. The data department is becoming concerned." : "Current trajectory acceptable. Continue collecting evidence."}</p></div>
      </div>
    </>
  );
}

function ExitModal({ onClose }) {
  const [stage, setStage] = useState(0);
  function terminate() {
    setStage(1);
    setTimeout(() => setStage(2), 1200);
  }

  return (
    <div className="modal-backdrop dark">
      <div className="modal exit-modal">
        <button className="icon-button" onClick={onClose}><X/></button>
        {stage === 0 && <>
          <div className="warning-icon"><ShieldAlert size={31}/></div>
          <div className="eyebrow">RELATIONSHIP TERMINATION DEPARTMENT</div>
          <h2>Exit relationship?</h2>
          <p>This action has been reviewed by HR, management, and several emotionally invested parties.</p>
          <div className="exit-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="danger-button solid" onClick={terminate}>Yes, terminate</button></div>
        </>}
        {stage === 1 && <div className="termination"><div className="spinner"></div><h2>Processing resignation…</h2><p>Consulting Michael Scott.</p></div>}
        {stage === 2 && <>
          {EXIT_GIF ? <img className="exit-gif" src={EXIT_GIF} alt="The Office reaction GIF"/> : <div className="office-fallback"><div className="office-face">ಠ_ಠ</div><strong>THE OFFICE HAS BEEN NOTIFIED</strong><span>They are not impressed.</span></div>}
          <div className="error-code">ERROR 418</div>
          <h2>Relationship termination denied.</h2>
          <p><strong>Reason:</strong> Girl too cute. Request classified as stupid.</p>
          <button className="primary wide" onClick={onClose}>Return to relationship</button>
        </>}
      </div>
    </div>
  );
}