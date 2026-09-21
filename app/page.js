"use client";

import { useEffect, useMemo, useState } from "react";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString([], { year:"numeric", month:"short", day:"numeric" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
}
function hours(start, stop) {
  return ((new Date(stop)-new Date(start))/36e5).toFixed(2);
}

export default function EmployeePage() {
  const [employees,setEmployees] = useState([]);
  const [employeeId,setEmployeeId] = useState("");
  const [pin,setPin] = useState("");
  const [notes,setNotes] = useState("");
  const [session,setSession] = useState(null);
  const [active,setActive] = useState(null);
  const [history,setHistory] = useState([]);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [now,setNow] = useState(new Date());

  async function jsonFetch(url, options={}) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type":"application/json", ...(options.headers||{}) }
    });
    const body = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(body.error || "Request failed.");
    return body;
  }

  async function loadPublic() {
    const body = await jsonFetch("/api/employees");
    setEmployees(body.employees);
  }

  async function loadMe() {
    try {
      const body = await jsonFetch("/api/me");
      setSession(body.session);
      setActive(body.active);
      if (body.session?.role === "employee") {
        const h = await jsonFetch("/api/history");
        setHistory(h.entries);
      }
    } catch {
      setSession(null);
      setActive(null);
      setHistory([]);
    }
  }

  useEffect(() => { loadPublic(); loadMe(); }, []);
  useEffect(() => {
    const t=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(t);
  }, []);

  async function login(e) {
    e.preventDefault();
    setError(""); setMessage("");
    try {
      await jsonFetch("/api/auth/employee", {
        method:"POST",
        body:JSON.stringify({employeeId,pin})
      });
      setPin("");
      await loadMe();
      setMessage("Signed in.");
    } catch(e) { setError(e.message); }
  }

  async function punchIn() {
    setError(""); setMessage("");
    try {
      const body = await jsonFetch("/api/punch/in", {
        method:"POST",
        body:JSON.stringify({notes})
      });
      setActive(body.entry);
      setNotes("");
      setMessage("Help Time started.");
    } catch(e) { setError(e.message); }
  }

  async function punchOut() {
    setError(""); setMessage("");
    try {
      await jsonFetch("/api/punch/out", { method:"POST", body:"{}" });
      setMessage("Help Time stopped.");
      await loadMe();
    } catch(e) { setError(e.message); }
  }

  async function logout() {
    await jsonFetch("/api/auth/logout", {method:"POST",body:"{}"});
    setSession(null); setActive(null); setHistory([]); setMessage(""); setError("");
  }

  const elapsed = useMemo(() => {
    if (!active) return "";
    const mins=Math.max(0,Math.floor((now-new Date(active.clock_in))/60000));
    return `${Math.floor(mins/60)}h ${mins%60}m elapsed`;
  },[active,now]);

  return (
    <main className="shell">
      <div className="topNav"><a className="secondary small linkButton" href="/admin">Admin / Payroll</a></div>

      <section className="card hero">
        <div>
          <p className="eyebrow">Employee Time Tracking</p>
          <h1>Help Time Clock</h1>
          <p className="muted">Use this clock only when working outside your normal assigned duties.</p>
        </div>
        <div className="liveClock">{now.toLocaleString([], {weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit"})}</div>
      </section>

      {!session ? (
        <section className="card">
          <form onSubmit={login}>
            <label>Employee</label>
            <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)} required>
              <option value="">Select your name</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.display_name}</option>)}
            </select>
            <label>PIN</label>
            <input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={e=>setPin(e.target.value)} required maxLength={12}/>
            <div style={{marginTop:16}}><button className="primary" type="submit">Continue</button></div>
          </form>
          {error && <div className="message error">{error}</div>}
        </section>
      ) : (
        <>
          <section className="card">
            <div className="sectionHeading">
              <div>
                <p className="eyebrow">Employee</p>
                <h2>{session.employeeName}</h2>
              </div>
              <button className="ghost small" onClick={logout}>Sign Out</button>
            </div>

            {!active && <>
              <label>Notes <span className="muted">(optional)</span></label>
              <textarea rows="3" maxLength="500" placeholder="Brief description of the work" value={notes} onChange={e=>setNotes(e.target.value)} />
            </>}

            <div className={`statusPanel ${active ? "active":""}`}>
              <div className="statusDot"></div>
              <div>
                <strong>{active ? "Clocked into Help Time" : "Not clocked into Help Time"}</strong>
                <div className="muted">{active ? `Started ${fmtTime(active.clock_in)} • ${elapsed}` : "Press Start Help Time when you begin outside-duty work."}</div>
              </div>
            </div>

            <div className="buttonRow">
              <button className="primary" disabled={!!active} onClick={punchIn}>Start Help Time</button>
              <button className="danger" disabled={!active} onClick={punchOut}>Stop Help Time</button>
            </div>
            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>}
          </section>

          <section className="card">
            <p className="eyebrow">Employee View</p>
            <h2>My Recent Help Time</h2>
            {!history.length ? <div className="emptyState">No completed Help Time entries yet.</div> :
              history.map(x=>(
                <div className="historyItem" key={x.id}>
                  <div>
                    <strong>{fmtDate(x.clock_in)}</strong>
                    <div className="muted">{fmtTime(x.clock_in)}–{fmtTime(x.clock_out)}</div>
                    {x.notes && <div className="muted">{x.notes}</div>}
                  </div>
                  <div className="historyHours">{hours(x.clock_in,x.clock_out)} hrs</div>
                </div>
              ))
            }
          </section>
        </>
      )}
      <footer>Help Time records are stored centrally and protected by employee PIN.</footer>
    </main>
  );
}
