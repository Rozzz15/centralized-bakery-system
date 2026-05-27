import { useState, useEffect } from "react";
import type { Role } from "../types";
import { signIn, updatePassword } from "../lib/auth";
import { getSecurityQuestionByEmail, verifySecurityAnswerByEmail, getPasswordSnapshot, getAllProfiles } from "../lib/db";

type Props = {
  onLogin: (role: Role, displayName: string) => void;
};

type RoleInfo = {
  id: Role;
  label: string;
  title: string;
  color: string;
  email: string;
  password: string;
  displayName: string;
};

const roleAccounts: RoleInfo[] = [
  { id: "admin", label: "Administrator", title: "Operations Director", color: "from-amber-600 to-orange-600", email: "admin1@bakeflow.com", password: "Admin@123", displayName: "Admin 1" },
  { id: "baker", label: "Baker", title: "Head Baker", color: "from-stone-600 to-neutral-700", email: "baker@bakeflow.com", password: "Baker@123", displayName: "Baker" },
  { id: "deco", label: "Deco", title: "Deco Lead", color: "from-rose-600 to-pink-600", email: "deco@bakeflow.com", password: "Deco@123", displayName: "Deco" },
  { id: "kitchen", label: "Kitchen", title: "Kitchen Supervisor", color: "from-emerald-600 to-teal-600", email: "kitchen@bakeflow.com", password: "Kitchen@123", displayName: "Kitchen" },
  { id: "branch", label: "Branch", title: "Branch Manager", color: "from-blue-600 to-indigo-600", email: "branch@bakeflow.com", password: "Branch@123", displayName: "Branch" },
];

const adminAccounts: { displayName: string; email: string }[] = [
  { displayName: "Admin 1", email: "admin1@bakeflow.com" },
  { displayName: "Admin 2", email: "admin2@bakeflow.com" },
];

export default function LoginPage({ onLogin }: Props) {
  const [view, setView] = useState<"roles" | "credentials" | "forgot">("roles");
  const [selectedRole, setSelectedRole] = useState<RoleInfo | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<"admin1" | "admin2">("admin1");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<"question" | "reset" | "done">("question");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [allProfilesData, setAllProfilesData] = useState<{ email: string; display_name: string; role: string }[]>([]);

  useEffect(() => {
    getAllProfiles().then(profiles => {
      setAllProfilesData(profiles.map(p => ({ email: p.email || "", display_name: p.display_name, role: p.role })));
    }).catch(() => {});
  }, []);

  function profileFor(email: string, defaultName: string): { email: string; name: string } {
    const match = allProfilesData.find(p => p.email === email || p.display_name === defaultName);
    if (match) return { email: match.email || email, name: match.display_name || defaultName };
    return { email, name: defaultName };
  }
  function profileForRole(roleId: string, email: string, defaultName: string): { email: string; name: string } {
    const match = allProfilesData.find(p => p.role === roleId);
    if (match) return { email: match.email || email, name: match.display_name || defaultName };
    return profileFor(email, defaultName);
  }

  // Admin profiles matched by index (first admin = admin1, second = admin2)
  const adminProfiles = allProfilesData.filter(p => p.email.includes("admin"));
  const admin1Profile = adminProfiles[0] || null;
  const admin2Profile = adminProfiles[1] || null;
  function getAdminProfile(idx: number): { email: string; name: string } {
    const p = idx === 0 ? admin1Profile : admin2Profile;
    if (p) return { email: p.email || adminAccounts[idx].email, name: p.display_name || adminAccounts[idx].displayName };
    return { email: adminAccounts[idx].email, name: adminAccounts[idx].displayName };
  }

  const handleRoleClick = (role: RoleInfo) => {
    setSelectedRole(role);
    setSelectedAdmin("admin1");
    setPassword("");
    setError("");
    setView("credentials");
  };

  const handleSignIn = async () => {
    setError("");
    if (!password.trim()) { setError("Enter the password to sign in."); return; }
    const email = selectedRole!.id === "admin"
      ? (selectedAdmin === "admin1" ? adminAccounts[0].email : adminAccounts[1].email)
      : selectedRole!.email;
    const displayName = selectedRole!.id === "admin"
      ? (selectedAdmin === "admin1" ? adminAccounts[0].displayName : adminAccounts[1].displayName)
      : selectedRole!.displayName;
    setLoading(true);
    try {
      const data = await signIn(email, password);
      if (data) {
        onLogin(selectedRole!.id, displayName);
      }
    } catch (err: any) {
      setError(err.message || "Sign in failed. Check your password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotStart = async () => {
    setError("");
    setForgotStep("question");
    setView("forgot");
    setSecurityQuestion("");
    setSecurityAnswer("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setForgotLoading(true);
    const email = selectedRole!.id === "admin"
      ? (selectedAdmin === "admin1" ? adminAccounts[0].email : adminAccounts[1].email)
      : selectedRole!.email;
    try {
      const q = await getSecurityQuestionByEmail(email);
      if (!q?.question) {
        setError("No security question set. First go to Settings > sidebar gear icon to set one up.");
      } else {
        setSecurityQuestion(q.question);
      }
    } catch {
      setError("Failed to load security question.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyAnswer = async () => {
    setError("");
    if (!securityAnswer.trim()) { setError("Enter your answer."); return; }
    const email = selectedRole!.id === "admin"
      ? (selectedAdmin === "admin1" ? adminAccounts[0].email : adminAccounts[1].email)
      : selectedRole!.email;
    setLoading(true);
    try {
      const valid = await verifySecurityAnswerByEmail(email, securityAnswer);
      if (!valid) { setError("Incorrect answer."); setLoading(false); return; }
      setForgotStep("reset");
    } catch {
      setError("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (!newPassword) { setError("Enter a new password."); return; }
    if (newPassword !== newPasswordConfirm) { setError("Passwords do not match."); return; }
    const email = selectedRole!.id === "admin"
      ? (selectedAdmin === "admin1" ? adminAccounts[0].email : adminAccounts[1].email)
      : selectedRole!.email;
    setLoading(true);
    try {
      const snapshot = await getPasswordSnapshot(email);
      if (snapshot) {
        await signIn(email, snapshot);
        await updatePassword(newPassword);
        setForgotStep("done");
      } else {
        setError("No password snapshot found. Use the email reset option or contact admin.");
      }
    } catch {
      setError("Could not reset password. The stored password snapshot may be outdated. Update it in Settings.");
    } finally {
      setLoading(false);
    }
  };

  if (view === "credentials" && selectedRole) {
    const isAdmin = selectedRole.id === "admin";
    const admin1 = getAdminProfile(0);
    const admin2 = getAdminProfile(1);
    const displayEmail = isAdmin
      ? (selectedAdmin === "admin1" ? admin1.email : admin2.email)
      : profileForRole(selectedRole.id, selectedRole.email, selectedRole.displayName).email;
    const currentDisplay = isAdmin
      ? (selectedAdmin === "admin1" ? admin1.name : admin2.name)
      : profileForRole(selectedRole.id, selectedRole.email, selectedRole.displayName).name;

    return (
      <div className="flex min-h-screen bg-[#0A0A0A] text-zinc-100 antialiased">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
          * { font-variant-ligatures: common-ligatures; }
        `}</style>

        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-950 p-12 lg:flex">
          <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-40" src="/video/log.mp4" />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/80 via-zinc-950/70 to-zinc-950/90" />
          <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[100px]" />
          <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-amber-300/5 blur-[100px]" />

          <div className="relative">
            <div className="grid h-14 w-14 place-items-center rounded-[14px] bg-white/10 shadow-lg backdrop-blur-md ring-1 ring-white/10">
              <span className="text-[26px] font-bold text-white">B</span>
            </div>
          </div>

          <div className="relative space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[12px] font-medium tracking-[0.15em] text-amber-400/80 uppercase" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <span className="h-px w-8 bg-amber-500/40" />
                BakeFlow ERP v2.0
              </div>
              <h1 className="text-[48px] font-semibold leading-[1.1] tracking-tight text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>
                Centralized
                <br />
                <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Bakery Control</span>
              </h1>
            </div>
            <p className="max-w-sm text-[15px] leading-relaxed text-zinc-400">
              Role-based access for production, inventory, dispatch, and branch management.
            </p>
            <div className="flex flex-wrap gap-3">
              {["Production", "Inventory", "Dispatch", "Analytics"].map(label => (
                <span key={label} className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-medium text-zinc-500 backdrop-blur-sm">{label}</span>
              ))}
            </div>
          </div>

          <div className="relative flex items-center gap-6 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <span className="text-emerald-400/70" style={{ fontFamily: "Fragment Mono, monospace" }}>All systems operational</span>
            </div>
            <span className="h-3 w-px bg-zinc-800" />
            <span className="text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>
              {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="relative flex w-full items-center justify-center overflow-hidden px-4 py-8 lg:w-1/2">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/5 via-zinc-950 to-zinc-950" />
          <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/3 blur-[120px]" />

          <div className="relative w-full max-w-[400px]">
            <button
              onClick={() => { setView("roles"); setError(""); }}
              className="group mb-6 flex items-center gap-1.5 text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
              Back to roles
            </button>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-[1px]">
              <div className="rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 sm:p-8">
                <div className="mb-6 flex flex-col items-center text-center">
                  <div className={`mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${selectedRole.color} shadow-lg`}>
                    <span className="text-xl font-bold text-white">{currentDisplay.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>Signing in as</h2>
                  <p className="text-[15px] font-medium text-zinc-300">{currentDisplay}</p>
                  <p className="text-[12px] text-zinc-500 mt-0.5">{selectedRole.title}</p>
                </div>

                {isAdmin && (
                  <div className="mb-5">
                    <label className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase mb-2 block">Select Account</label>
                    <div className="flex rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800">
                      {adminAccounts.map((_, i) => {
                        const p = i === 0 ? admin1 : admin2;
                        return (
                        <button
                          key={i}
                          onClick={() => { setSelectedAdmin(i === 0 ? "admin1" : "admin2"); setError(""); setPassword(""); }}
                          className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition-all ${
                            (i === 0 && selectedAdmin === "admin1") || (i === 1 && selectedAdmin === "admin2")
                              ? "bg-zinc-800 text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {p.name}
                        </button>
                      );})}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Email</label>
                    <div className="relative mt-1.5">
                      <input
                        value={displayEmail}
                        readOnly
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 py-2.5 px-3 text-[14px] text-zinc-500 outline-none cursor-default"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Password</label>
                    <div className="relative mt-1.5">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSignIn()}
                        placeholder="Enter password"
                        autoFocus
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2.5 pl-3 pr-10 text-[14px] text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-amber-700 focus:ring-1 focus:ring-amber-700/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                      >
                        {showPassword ? "🙈" : "👁"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleForgotStart}
                      className="mt-2 text-[12px] text-zinc-600 hover:text-amber-400 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-red-900/50 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-500/20 text-[10px]">!</span>
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleSignIn}
                    disabled={loading}
                    className="relative w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-[14px] font-medium text-white shadow-lg shadow-amber-600/20 transition-all hover:from-amber-500 hover:to-orange-500 hover:shadow-amber-500/30 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Signing in...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Sign In as {currentDisplay}
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>
              &copy; {new Date().getFullYear()} BakeFlow ERP
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === "forgot" && selectedRole) {
    const isAdmin = selectedRole.id === "admin";
    const displayEmail = isAdmin
      ? (selectedAdmin === "admin1" ? getAdminProfile(0).email : getAdminProfile(1).email)
      : profileForRole(selectedRole.id, selectedRole.email, selectedRole.displayName).email;

    return (
      <div className="flex min-h-screen bg-[#0A0A0A] text-zinc-100 antialiased">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
          * { font-variant-ligatures: common-ligatures; }
        `}</style>

        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-950 p-12 lg:flex">
          <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-40" src="/video/log.mp4" />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/80 via-zinc-950/70 to-zinc-950/90" />
          <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[100px]" />
          <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-amber-300/5 blur-[100px]" />
          <div className="relative"><div className="grid h-14 w-14 place-items-center rounded-[14px] bg-white/10 shadow-lg backdrop-blur-md ring-1 ring-white/10"><span className="text-[26px] font-bold text-white">B</span></div></div>
          <div className="relative space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[12px] font-medium tracking-[0.15em] text-amber-400/80 uppercase" style={{ fontFamily: "Fragment Mono, monospace" }}>
                <span className="h-px w-8 bg-amber-500/40" />BakeFlow ERP v2.0
              </div>
              <h1 className="text-[48px] font-semibold leading-[1.1] tracking-tight text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>
                Centralized<br /><span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Bakery Control</span>
              </h1>
            </div>
            <p className="max-w-sm text-[15px] leading-relaxed text-zinc-400">Recover access to your account.</p>
          </div>
          <div className="relative flex items-center gap-6 text-[12px]">
            <span className="text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>
              {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="relative flex w-full items-center justify-center overflow-hidden px-4 py-8 lg:w-1/2">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/5 via-zinc-950 to-zinc-950" />
          <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/3 blur-[120px]" />

          <div className="relative w-full max-w-[400px]">
            <button onClick={() => { setView("credentials"); setError(""); }} className="group mb-6 flex items-center gap-1.5 text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">
              <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
              Back to sign in
            </button>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-[1px]">
              <div className="rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 sm:p-8">
                {forgotStep === "done" ? (
                  <div className="flex flex-col items-center text-center py-4">
                    <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>Password Reset</h2>
                    <p className="mt-2 text-[13px] text-zinc-400">Your password has been changed.</p>
                    <button onClick={() => setView("credentials")} className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-[14px] font-medium text-white shadow-lg shadow-amber-600/20 transition-all hover:from-amber-500 hover:to-orange-500 active:scale-[0.99]">Sign In</button>
                  </div>
                ) : forgotStep === "reset" ? (
                  <>
                    <div className="mb-6 flex flex-col items-center text-center">
                      <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg"><span className="text-xl font-bold text-white">PW</span></div>
                      <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>New Password</h2>
                      <p className="text-[13px] text-zinc-400 mt-1">for {displayEmail}</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">New Password</label>
                        <div className="relative mt-1.5">
                          <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2.5 pl-3 pr-10 text-[14px] text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-amber-700 focus:ring-1 focus:ring-amber-700/30" />
                          <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">{showNewPassword ? "🙈" : "👁"}</button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Confirm Password</label>
                        <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} placeholder="Confirm new password" className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2.5 px-3 text-[14px] text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-amber-700 focus:ring-1 focus:ring-amber-700/30" />
                      </div>
                      {error && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-red-900/50 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-500/20 text-[10px]">!</span>
                          {error}
                        </div>
                      )}
                      <button onClick={handleResetPassword} disabled={loading} className="relative w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-[14px] font-medium text-white shadow-lg shadow-amber-600/20 transition-all hover:from-amber-500 hover:to-orange-500 active:scale-[0.99] disabled:opacity-40">
                        {loading ? (
                          <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Resetting...</span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">Reset Password <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7l7 7-7 7"/></svg></span>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-6 flex flex-col items-center text-center">
                      <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg"><span className="text-xl font-bold text-white">?</span></div>
                      <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>Security Question</h2>
                      <p className="text-[13px] text-zinc-400 mt-1">Verify your identity for {displayEmail}</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Question</label>
                        <div className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-[14px] text-zinc-300">
                          {forgotLoading ? (
                            <span className="flex items-center gap-2"><span className="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-transparent" /> Loading...</span>
                          ) : securityQuestion ? (
                            securityQuestion
                          ) : (
                            <span className="text-zinc-500">No question set</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-[12px] font-medium tracking-wide text-zinc-400 uppercase">Your Answer</label>
                        <input value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} onKeyDown={e => e.key === "Enter" && handleVerifyAnswer()} placeholder="Type your answer" autoFocus className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2.5 px-3 text-[14px] text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-amber-700 focus:ring-1 focus:ring-amber-700/30" />
                      </div>
                      {error && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-red-900/50 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-500/20 text-[10px]">!</span>
                          {error}
                        </div>
                      )}
                      <button onClick={handleVerifyAnswer} disabled={loading} className="relative w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-[14px] font-medium text-white shadow-lg shadow-amber-600/20 transition-all hover:from-amber-500 hover:to-orange-500 active:scale-[0.99] disabled:opacity-40">
                        {loading ? (
                          <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Verifying...</span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">Verify Answer <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7l7 7-7 7"/></svg></span>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>
              &copy; {new Date().getFullYear()} BakeFlow ERP
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-zinc-100 antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        * { font-variant-ligatures: common-ligatures; }
      `}</style>

      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-950 p-12 lg:flex">
        <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-40" src="/video/log.mp4" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/80 via-zinc-950/70 to-zinc-950/90" />
        <div className="absolute -right-20 -top-20 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[100px]" />
        <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-amber-300/5 blur-[100px]" />

        <div className="relative">
          <div className="grid h-14 w-14 place-items-center rounded-[14px] bg-white/10 shadow-lg backdrop-blur-md ring-1 ring-white/10">
            <span className="text-[26px] font-bold text-white">B</span>
          </div>
        </div>

        <div className="relative space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[12px] font-medium tracking-[0.15em] text-amber-400/80 uppercase" style={{ fontFamily: "Fragment Mono, monospace" }}>
              <span className="h-px w-8 bg-amber-500/40" />
              BakeFlow ERP v2.0
            </div>
            <h1 className="text-[48px] font-semibold leading-[1.1] tracking-tight text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>
              Centralized
              <br />
              <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">Bakery Control</span>
            </h1>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-zinc-400">
            Select your role to access the production dashboard. Each role has a dedicated account — just pick and sign in.
          </p>
          <div className="flex flex-wrap gap-3">
            {["Production", "Inventory", "Dispatch", "Analytics"].map(label => (
              <span key={label} className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-medium text-zinc-500 backdrop-blur-sm">{label}</span>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-6 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
            <span className="text-emerald-400/70" style={{ fontFamily: "Fragment Mono, monospace" }}>All systems operational</span>
          </div>
          <span className="h-3 w-px bg-zinc-800" />
          <span className="text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>
            {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="relative flex w-full items-center justify-center overflow-hidden px-4 py-8 lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/5 via-zinc-950 to-zinc-950" />
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/3 blur-[120px]" />

        <div className="relative w-full max-w-[420px]">
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-600/20 ring-1 ring-white/10">
              <span className="text-xl font-bold text-white">B</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white" style={{ fontFamily: "Instrument Sans, system-ui" }}>BakeFlow ERP</h1>
            <p className="mt-1 text-sm text-zinc-500">Select your role to sign in</p>
          </div>

          <div className="space-y-2.5">
            {roleAccounts.map(role => (
              <button
                key={role.id}
                onClick={() => handleRoleClick(role)}
                className="group relative w-full flex items-center gap-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3.5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800/60 hover:shadow-lg active:scale-[0.99]"
              >
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br ${role.color} shadow-sm transition-transform group-hover:scale-105`}>
                  <span className="text-[13px] font-bold text-white">{role.label.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium text-zinc-200 group-hover:text-white transition-colors">{role.label}</span>
                    {role.id === "admin" && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">2 accounts</span>
                    )}
                  </div>
                  <div className="text-[12px] text-zinc-500 mt-0.5">{role.title}</div>
                </div>
                <svg className="h-4 w-4 text-zinc-600 transition-all group-hover:text-zinc-300 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-zinc-600 text-xs">✦</span>
              <p className="text-[12px] text-zinc-600 leading-relaxed">
                Each role uses a pre-configured default account. Just select your role and enter the password shown.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-zinc-700" style={{ fontFamily: "Fragment Mono, monospace" }}>
            &copy; {new Date().getFullYear()} BakeFlow ERP &mdash; Centralized Bakery Supply Chain
          </p>
        </div>
      </div>
    </div>
  );
}
