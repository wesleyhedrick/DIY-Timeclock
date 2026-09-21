"use client";

import { useEffect, useMemo, useState } from "react";

function localBoundary(dateString, end=false) {
  if (!dateString) return "";
  const d = new Date(`${dateString}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return d.toISOString();
}
function fmtDate(iso){ return new Date(iso).toLocaleDateString(); }
function fmtTime(iso){ return new Date(iso).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"}); }
function hrs(a,b){ return ((new Date(b)-new Date(a))/36e5).toFixed(2); }

export default function AdminPage() {
  const [password,setPassword]=useState("");
  const [loggedIn,setLoggedIn]=useState(false);
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [entries,setEntries]=useState([]);
  const [error,setError]=useState("");

  async function jsonFetch(url,options={}) {
    const res=await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const body=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(body.error||"Request failed.");
    return body;
  }

  async function check() {
    try {
      const me=await jsonFetch("/api/me");
      setLoggedIn(me.session?.role==="admin");
    } catch { setLoggedIn(false); }
  }
  useEffect(()=>{ check(); },[]);

  async function login(e) {
    e.preventDefault(); setError("");
    try {
      await jsonFetch("/api/auth/admin",{method:"POST",body:JSON.stringify({password})});
      setPassword(""); setLoggedIn(true);
    } catch(e){ setError(e.message); }
  }

  async function loadEntries() {
    setError("");
    try {
      const q=new URLSearchParams();
      const start=localBoundary(from,false), end=localBoundary(to,true);
      if(start) q.set("from",start);
      if(end) q.set("to",end);
      const body=await jsonFetch(`/api/admin/entries?${q.toString()}`);
      setEntries(body.entries);
    } catch(e){ setError(e.message); }
  }

  async function logout() {
    await jsonFetch("/api/auth/logout",{method:"POST",body:"{}"});
    setLoggedIn(false); setEntries([]);
  }

  function exportCsv() {
    if(!entries.length){ setError("There are no records to export."); return; }
    const rows=[
      ["Employee","Date","Clock In","Clock Out","Total Hours","Notes"],
      ...entries.map(x=>[
        x.employees.display_name,
        fmtDate(x.clock_in),
        fmtTime(x.clock_in),
        fmtTime(x.clock_out),
        hrs(x.clock_in,x.clock_out),
        x.notes||""
      ])
    ];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`help-time-${from||"all"}-to-${to||"all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <div className="topNav"><a className="secondary small linkButton" href="/">Employee Clock</a></div>
      <section className="card hero">
        <div><p className="eyebrow">Administration</p><h1>Help Time Payroll</h1><p className="muted">Review activity and export a CSV for any date range.</p></div>
      </section>

      {!loggedIn ? (
        <section className="card">
          <form onSubmit={login}>
            <label>Admin Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
            <div style={{marginTop:16}}><button className="primary">Sign In</button></div>
          </form>
          {error&&<div className="message error">{error}</div>}
        </section>
      ) : (
        <section className="card">
          <div className="sectionHeading">
            <div><p className="eyebrow">Payroll View</p><h2>Help Time Activity</h2></div>
            <button className="ghost small" onClick={logout}>Sign Out</button>
          </div>

          <div className="filterGrid">
            <div><label>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></div>
            <div><label>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} /></div>
          </div>
          <div className="adminActions">
            <button className="primary" onClick={loadEntries}>Load Activity</button>
            <button className="secondary" onClick={exportCsv}>Export Loaded CSV</button>
          </div>
          {error&&<div className="message error">{error}</div>}
          <div className="tableWrap">
            <table>
              <thead><tr><th>Employee</th><th>Date</th><th>Start</th><th>Stop</th><th>Hours</th><th>Notes</th></tr></thead>
              <tbody>
                {entries.map(x=>(
                  <tr key={x.id}>
                    <td>{x.employees.display_name}</td>
                    <td>{fmtDate(x.clock_in)}</td>
                    <td>{fmtTime(x.clock_in)}</td>
                    <td>{fmtTime(x.clock_out)}</td>
                    <td>{hrs(x.clock_in,x.clock_out)}</td>
                    <td>{x.notes||""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!entries.length&&<div className="emptyState">Choose a date range and load activity.</div>}
        </section>
      )}
    </main>
  );
}
