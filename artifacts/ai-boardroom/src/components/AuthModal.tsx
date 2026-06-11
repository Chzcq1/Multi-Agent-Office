import { useState } from "react";
import { LogIn, Mail, Lock, Chrome, X, Loader2 } from "lucide-react";

interface AuthModalProps {
  onClose: () => void;
}

type AuthMode = "login" | "signup";

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabaseEnabled = !!(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  async function handleGoogleLogin() {
    if (!supabaseEnabled) {
      setError("Supabase ยังไม่ได้ตั้งค่า — ฟีเจอร์นี้ใช้ได้เฉพาะบน Vercel");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { signInWithGoogle } = await import("@workspace/supabase");
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseEnabled) {
      setError("Supabase ยังไม่ได้ตั้งค่า — ฟีเจอร์นี้ใช้ได้เฉพาะบน Vercel");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        const { signInWithEmail } = await import("@workspace/supabase");
        await signInWithEmail(email, password);
        onClose();
      } else {
        const { signUpWithEmail } = await import("@workspace/supabase");
        await signUpWithEmail(email, password, displayName);
        setSuccess("สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยัน");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <LogIn size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold">AI Boardroom</h2>
              <p className="text-xs text-white/70">
                {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Supabase warning banner */}
          {!supabaseEnabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
              ⚠️ ระบบ Auth ใช้งานได้เมื่อ deploy บน Vercel + ตั้งค่า Supabase
            </div>
          )}

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Chrome size={16} className="text-blue-500" />
            {mode === "login" ? "เข้าสู่ระบบด้วย Google" : "สมัครด้วย Google"}
          </button>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-100" />
            หรือใช้อีเมล
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อ</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ชื่อของคุณ"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">อีเมล</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">รหัสผ่าน</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}
            {success && (
              <p className="text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-xs text-gray-500">
            {mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีแล้ว?"}
            {" "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setSuccess(null); }}
              className="text-blue-500 hover:underline font-medium"
            >
              {mode === "login" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </button>
          </p>

          {/* Credits info */}
          <div className="bg-indigo-50 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xs text-indigo-700">
              🎁 สมาชิกใหม่รับ <strong>100 เครดิต</strong> ฟรีทันที
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">
              ใช้สำหรับการวิเคราะห์กลยุทธ์ (LEVEL 3 = 8 เครดิต)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
