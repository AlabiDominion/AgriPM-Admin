import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const base = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);
function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("agripm-admin") || "",
  );
  const [account, setAccount] = useState(null);
  const [page, setPage] = useState("users");
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  function clearSession() {
    sessionStorage.removeItem("agripm-admin");
    setToken("");
    setAccount(null);
    setUsers([]);
    setCases([]);
  }
  const request = useCallback(
    async (path, options = {}, customToken = token) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(base + path, {
          ...options,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(customToken ? { Authorization: "Bearer " + customToken } : {}),
          },
          ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401 && customToken) clearSession();
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Check your input and try again.",
          );
        }
        return data;
      } catch (e) {
        if (e.name === "AbortError")
          throw new Error("The server took too long. Try again.");
        throw e;
      } finally {
        clearTimeout(timer);
      }
    },
    [token],
  );
  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const me = await request("/auth/me");
      if (me.role !== "admin") {
        clearSession();
        throw new Error("Administrator account required.");
      }
      setAccount(me);
      const [nextUsers, nextCases] = await Promise.all([
        request("/admin/users"),
        request("/admin/support"),
      ]);
      setUsers(nextUsers);
      setCases(nextCases);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, request]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function signIn(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await request(
        "/auth/login",
        { method: "POST", body: login },
        "",
      );
      if (result.user.role !== "admin") {
        await request("/auth/logout", { method: "POST" }, result.token);
        throw new Error("This portal requires an administrator account.");
      }
      sessionStorage.setItem("agripm-admin", result.token);
      setToken(result.token);
      setAccount(result.user);
      setLogin({ email: "", password: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function logout() {
    setLoading(true);
    setError("");
    try {
      await request("/auth/logout", { method: "POST" });
      clearSession();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function changeUser(user) {
    if (
      !window.confirm(
        (user.active ? "Deactivate " : "Reactivate ") +
          user.name +
          "? Deactivation immediately revokes their sessions.",
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      await request("/admin/users/" + user.id, {
        method: "PATCH",
        body: { active: !user.active },
      });
      setSelectedUser(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function saveCase(item, body) {
    setLoading(true);
    setError("");
    try {
      await request("/admin/support/" + item.id, { method: "PATCH", body });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  if (!token)
    return (
      <main className="login-shell">
        <section className="login-story">
          <div className="brand">❧ AgriPM</div>
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h1>
              Support the people
              <br />
              who help us grow.
            </h1>
            <p>Account management and farmer support, in one place.</p>
          </div>
          <small>Plan. Manage. Grow.</small>
        </section>
        <section className="login-form">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Admin sign in</h2>
          <p className="muted">Use your administrator account to continue.</p>
          <form onSubmit={signIn}>
            <label>
              Email address
              <input
                type="email"
                required
                value={login.email}
                onChange={(e) => setLogin({ ...login, email: e.target.value })}
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={login.password}
                onChange={(e) =>
                  setLogin({ ...login, password: e.target.value })
                }
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="privacy">
            Private farm projects remain inaccessible to platform admins.
          </p>
        </section>
      </main>
    );
  const visibleUsers = users.filter((u) =>
    (u.name + " " + u.email).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">❧ AgriPM</div>
        <p className="eyebrow">ADMIN PORTAL</p>
        <nav>
          <button
            className={page === "users" ? "nav-active" : ""}
            onClick={() => setPage("users")}
          >
            User Accounts
          </button>
          <button
            className={page === "support" ? "nav-active" : ""}
            onClick={() => setPage("support")}
          >
            Support Cases
          </button>
        </nav>
        <div className="aside-bottom">
          <span>{account?.name || "Administrator"}</span>
          <small>{account?.email}</small>
          <button className="outline" onClick={logout} disabled={loading}>
            Log Out
          </button>
        </div>
      </aside>
      <main className="content">
        <header>
          <div>
            <p className="eyebrow">AGriPM OPERATIONS</p>
            <h1>{page === "users" ? "User Accounts" : "Support Cases"}</h1>
            <p className="muted">
              Manage access and help farmers move forward.
            </p>
          </div>
          <button className="outline" disabled={loading} onClick={refresh}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>
        <div className="stats">
          <article>
            <span>Total accounts</span>
            <strong>{users.length}</strong>
          </article>
          <article>
            <span>Active farmers</span>
            <strong>
              {users.filter((u) => u.active && u.role === "farmer").length}
            </strong>
          </article>
          <article>
            <span>Open support cases</span>
            <strong>
              {cases.filter((c) => c.status !== "resolved").length}
            </strong>
          </article>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="privacy">
          Privacy boundary: this portal has no access to farmers’ projects,
          tasks, expenses, risks or evaluations.
        </p>
        {page === "users" ? (
          <section className="panel">
            <div className="panel-heading">
              <h2>Registered users</h2>
              <input
                aria-label="Search users"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelectedUser(user)}
                        >
                          {user.name}
                        </button>
                        <small>{user.email}</small>
                      </td>
                      <td>{user.role}</td>
                      <td>
                        <span
                          className={user.active ? "badge green" : "badge red"}
                        >
                          {user.active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td>{user.created_at.slice(0, 10)}</td>
                      <td>
                        {user.role !== "admin" && (
                          <button
                            className="outline small"
                            disabled={loading}
                            onClick={() => changeUser(user)}
                          >
                            {user.active ? "Deactivate" : "Reactivate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visibleUsers.length && (
              <p className="empty">No matching accounts.</p>
            )}
          </section>
        ) : (
          <section className="case-grid">
            {cases.map((item) => (
              <SupportCase
                key={item.id + item.status + item.admin_reply}
                item={item}
                busy={loading}
                onSave={saveCase}
              />
            ))}
            {!cases.length && (
              <div className="panel empty">No support requests yet.</div>
            )}
          </section>
        )}
        {selectedUser && (
          <div className="modal-backdrop" onClick={() => setSelectedUser(null)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-label="User details"
              className="panel modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="outline close"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>
              <h2>{selectedUser.name}</h2>
              <p>{selectedUser.email}</p>
              <p className="muted">
                Role: {selectedUser.role} ·{" "}
                {selectedUser.active ? "Active" : "Deactivated"}
              </p>
              <p className="muted">
                Registered {selectedUser.created_at.slice(0, 10)}
              </p>
              <p className="privacy">
                Private project records are not available.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
function SupportCase({ item, busy, onSave }) {
  const [status, setStatus] = useState(item.status);
  const [reply, setReply] = useState(item.admin_reply);
  return (
    <article className="panel support-card">
      <div className="panel-heading">
        <h2>{item.subject}</h2>
        <span className="badge green">{item.status.replaceAll("_", " ")}</span>
      </div>
      <p className="muted">
        {item.user_name} · {item.user_email}
      </p>
      <small>{item.created_at.slice(0, 10)}</small>
      <p className="case-message">{item.message}</p>
      <label>
        Status
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <label>
        Reply to farmer
        <textarea
          aria-label="Reply to farmer"
          rows="3"
          maxLength={3000}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
      </label>
      <button
        disabled={busy}
        onClick={() => onSave(item, { status, admin_reply: reply })}
      >
        Save Case
      </button>
    </article>
  );
}
createRoot(document.getElementById("root")).render(<App />);
