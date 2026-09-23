"use client";

import { useEffect, useMemo, useState } from "react";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function hours(start, stop) {
  return ((new Date(stop) - new Date(start)) / 36e5).toFixed(2);
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill="currentColor" />
      <circle cx="16.5" cy="9" r="2.4" fill="currentColor" opacity=".7" />
      <path d="M3.5 18c0-3.4 2.6-5.6 5.5-5.6s5.5 2.2 5.5 5.6v1H3.5v-1Z" fill="currentColor" />
      <path d="M14.2 13.8c3.6-.3 6.3 1.8 6.3 4.9V19h-4.8v-.8c0-1.8-.5-3.2-1.5-4.4Z" fill="currentColor" opacity=".7" />
    </svg>
  );
}

export default function EmployeePage() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [notes, setNotes] = useState("");
  const [session, setSession] = useState(null);
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

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

  async function loadPublic() {
    try {
      const body = await jsonFetch("/api/employees");
      setEmployees(body.employees || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadMe() {
    try {
      const body = await jsonFetch("/api/me");
      setSession(body.session);
      setActive(body.active);

      if (body.session?.role === "employee") {
        const h = await jsonFetch("/api/history");
        setHistory(h.entries || []);
      }
    } catch {
      setSession(null);
      setActive(null);
      setHistory([]);
    }
  }

  useEffect(() => {
    loadPublic();
    loadMe();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function login(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await jsonFetch("/api/auth/employee", {
        method: "POST",
        body: JSON.stringify({ employeeId, pin }),
      });
      setPin("");
      await loadMe();
      setMessage("Signed in.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function punchIn() {
    setError("");
    setMessage("");

    try {
      const body = await jsonFetch("/api/punch/in", {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      setActive(body.entry);
      setNotes("");
      setMessage("Help Time started.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function punchOut() {
    setError("");
    setMessage("");

    try {
      await jsonFetch("/api/punch/out", {
        method: "POST",
        body: "{}",
      });
      setMessage("Help Time stopped.");
      await loadMe();
    } catch (e) {
      setError(e.message);
    }
  }

  async function logout() {
    await jsonFetch("/api/auth/logout", {
      method: "POST",
      body: "{}",
    });
    setSession(null);
    setActive(null);
    setHistory([]);
    setMessage("");
    setError("");
  }

  const elapsed = useMemo(() => {
    if (!active) return "";
    const mins = Math.max(
      0,
      Math.floor((now - new Date(active.clock_in)) / 60000)
    );
    return `${Math.floor(mins / 60)}h ${mins % 60}m elapsed`;
  }, [active, now]);

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
            <h1>Help Time Clock</h1>
            <p>TEAM SUPPORT. A STRONGER TOMORROW.</p>
          </div>

          <a className="admin-link" href="/admin">
            Admin / Payroll
          </a>
        </div>

        <div className="hero-band">
          <div className="hero-copy">
            <span>PEOPLE &nbsp;|&nbsp; SERVICE &nbsp;|&nbsp; A CLEANER TOMORROW</span>
            <strong>
              Shaping a <em>Sustainable Future</em>
            </strong>
          </div>
          <div className="hero-values">
            SAFER<br />
            CLEANER<br />
            GREENER<br />
            TOGETHER
          </div>
        </div>
      </header>

      <div className="content-wrap">
        <section className="main-card">
          <div className="card-heading">
            <div className="icon-bubble">
              <PeopleIcon />
            </div>
            <div>
              <h2>Help Time Clock</h2>
              <p>Log the time you spend helping outside your normal assigned duties.</p>
            </div>
          </div>

          {!session ? (
            <form className="clock-grid" onSubmit={login}>
              <div className="form-panel">
                <label htmlFor="employee">Employee</label>
                <select
                  id="employee"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Select your name</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.display_name}
                    </option>
                  ))}
                </select>

                <label htmlFor="pin">PIN</label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  maxLength={12}
                />

              </div>

              <div className="action-panel">
                <div className="status-box">
                  <div className="clock-bubble">
                    <ClockIcon />
                  </div>
                  <div>
                    <strong>Not clocked into Help Time</strong>
                    <p>Select your name and enter your PIN to get started.</p>
                  </div>
                </div>

                <button className="action-button start" type="submit">
                  <span className="play-icon">▶</span>
                  Continue
                </button>

                <button className="action-button stop" type="button" disabled>
                  <span className="stop-icon">■</span>
                  Stop Help Time
                </button>
              </div>
            </form>
          ) : (
            <div className="clock-grid">
              <div className="form-panel">
                <div className="signed-in-line">
                  <div>
                    <span className="signed-label">Employee</span>
                    <strong>{session.employeeName}</strong>
                  </div>
                  <button className="text-button" onClick={logout}>
                    Sign Out
                  </button>
                </div>

                {!active && (
                  <>
                    <label htmlFor="notes">
                      Notes <span>(optional)</span>
                    </label>
                    <textarea
                      id="notes"
                      rows="5"
                      maxLength="500"
                      placeholder="What are you helping with?"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </>
                )}

                {active && (
                  <div className="active-note">
                    <span>Current note</span>
                    <strong>{active.notes || "No note entered"}</strong>
                  </div>
                )}
              </div>

              <div className="action-panel">
                <div className={`status-box ${active ? "active" : ""}`}>
                  <div className="clock-bubble">
                    <ClockIcon />
                  </div>
                  <div>
                    <strong>
                      {active
                        ? "Clocked into Help Time"
                        : "Not clocked into Help Time"}
                    </strong>
                    <p>
                      {active
                        ? `Started ${fmtTime(active.clock_in)} • ${elapsed}`
                        : "Press Start Help Time when you begin outside-duty work."}
                    </p>
                  </div>
                </div>

                <button
                  className="action-button start"
                  disabled={!!active}
                  onClick={punchIn}
                >
                  <span className="play-icon">▶</span>
                  Start Help Time
                </button>

                <button
                  className="action-button stop"
                  disabled={!active}
                  onClick={punchOut}
                >
                  <span className="stop-icon">■</span>
                  Stop Help Time
                </button>
              </div>
            </div>
          )}

          {message && <div className="notice success">{message}</div>}
          {error && <div className="notice error">{error}</div>}
        </section>

        <section className="history-card">
          <div className="history-heading">
            <div className="history-title-group">
              <div className="small-clock">
                <ClockIcon />
              </div>
              <div>
                <h2>My Recent Help Time</h2>
                <p>Your most recent completed Help Time entries.</p>
              </div>
            </div>
          </div>

          {!session ? (
            <div className="empty-state">
              Sign in to view your recent Help Time activity.
            </div>
          ) : !history.length ? (
            <div className="empty-state">
              No completed Help Time entries yet.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>Stop Time</th>
                    <th>Hours</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((x) => (
                    <tr key={x.id}>
                      <td>{fmtDate(x.clock_in)}</td>
                      <td>{fmtTime(x.clock_in)}</td>
                      <td>{fmtTime(x.clock_out)}</td>
                      <td>{hours(x.clock_in, x.clock_out)}</td>
                      <td>{x.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <footer className="site-footer">
        <span>Help Time Clock</span>
        <span>
          {now.toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </footer>
    </main>
  );
}
