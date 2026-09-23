"use client";

import { useEffect, useState } from "react";

function localBoundary(dateString, end = false) {
  if (!dateString) return "";
  const d = new Date(
    `${dateString}T${end ? "23:59:59.999" : "00:00:00.000"}`
  );
  return d.toISOString();
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString();
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function hrs(a, b) {
  return ((new Date(b) - new Date(a)) / 36e5).toFixed(2);
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");

  async function jsonFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body.error || "Request failed.");
    }

    return body;
  }

  async function check() {
    try {
      const me = await jsonFetch("/api/me");
      setLoggedIn(me.session?.role === "admin");
    } catch {
      setLoggedIn(false);
    }
  }

  useEffect(() => {
    check();
  }, []);

  async function login(e) {
    e.preventDefault();
    setError("");

    try {
      await jsonFetch("/api/auth/admin", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setPassword("");
      setLoggedIn(true);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadEntries() {
    setError("");

    try {
      const q = new URLSearchParams();
      const start = localBoundary(from, false);
      const end = localBoundary(to, true);

      if (start) q.set("from", start);
      if (end) q.set("to", end);

      const body = await jsonFetch(`/api/admin/entries?${q.toString()}`);
      setEntries(body.entries || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function logout() {
    await jsonFetch("/api/auth/logout", {
      method: "POST",
      body: "{}",
    });
    setLoggedIn(false);
    setEntries([]);
  }

  function exportCsv() {
    if (!entries.length) {
      setError("There are no records to export.");
      return;
    }

    const rows = [
      ["Employee", "Date", "Clock In", "Clock Out", "Total Hours", "Notes"],
      ...entries.map((x) => [
        x.employees.display_name,
        fmtDate(x.clock_in),
        fmtTime(x.clock_in),
        fmtTime(x.clock_out),
        hrs(x.clock_in, x.clock_out),
        x.notes || "",
      ]),
    ];

    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `help-time-${from || "all"}-to-${to || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="brand-header">
        <div className="brand-row">
          <div className="coastal-brand">
            <div className="coastal-mark" aria-hidden="true">
              <span className="wave wave-a"></span>
              <span className="wave wave-b"></span>
              <span className="wave wave-c"></span>
            </div>
            <div>
              <div className="coastal-name">Coastal</div>
              <div className="coastal-sub">WASTE &amp; RECYCLING</div>
            </div>
          </div>

          <div className="brand-divider"></div>

          <div className="title-lockup">
            <h1>Help Time Payroll</h1>
            <p>ADMINISTRATION &amp; REPORTING</p>
          </div>

          <a className="admin-link" href="/">
            Employee Clock
          </a>
        </div>

        <div className="hero-band">
          <div className="hero-copy">
            <span>PAYROLL &nbsp;|&nbsp; ACCURACY &nbsp;|&nbsp; ACCOUNTABILITY</span>
            <strong>
              Help Time <em>Reporting</em>
            </strong>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        {!loggedIn ? (
          <section className="main-card">
            <div className="card-heading">
              <div>
                <h2>Admin Sign In</h2>
                <p>Enter the administrative password to view payroll activity.</p>
              </div>
            </div>

            <form onSubmit={login} className="form-panel">
              <label htmlFor="admin-password">Admin Password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div style={{ marginTop: 16 }}>
                <button className="action-button start" type="submit">
                  Sign In
                </button>
              </div>
            </form>

            {error && <div className="notice error">{error}</div>}
          </section>
        ) : (
          <section className="main-card">
            <div className="history-heading">
              <div>
                <h2>Help Time Activity</h2>
                <p>Review completed punches and export a payroll CSV.</p>
              </div>
              <button className="text-button" onClick={logout}>
                Sign Out
              </button>
            </div>

            <div className="filterGrid">
              <div>
                <label>From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label>To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            <div className="adminActions">
              <button className="action-button start" onClick={loadEntries}>
                Load Activity
              </button>
              <button className="secondaryButton" onClick={exportCsv}>
                Export Loaded CSV
              </button>
            </div>

            {error && <div className="notice error">{error}</div>}

            <div className="table-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Start</th>
                    <th>Stop</th>
                    <th>Hours</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((x) => (
                    <tr key={x.id}>
                      <td>{x.employees.display_name}</td>
                      <td>{fmtDate(x.clock_in)}</td>
                      <td>{fmtTime(x.clock_in)}</td>
                      <td>{fmtTime(x.clock_out)}</td>
                      <td>{hrs(x.clock_in, x.clock_out)}</td>
                      <td>{x.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!entries.length && (
              <div className="empty-state">
                Choose a date range and load activity.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
