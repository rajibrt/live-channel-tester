export default function LoginPage() {
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Admin Login</h1>
      <form method="post" action="/api/auth/login">
        <label style={{ display: "block", marginBottom: 10 }}>
          <div>Email</div>
          <input name="email" type="email" required style={{ width: "100%", padding: 10 }} />
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <div>Password</div>
          <input name="password" type="password" required style={{ width: "100%", padding: 10 }} />
        </label>
        <button type="submit" style={{ padding: "10px 14px" }}>Login</button>
      </form>
      <p style={{ marginTop: 12, color: "#666" }}>
        Access is restricted to users listed in <code>admin_users</code>.
      </p>
    </main>
  );
}
