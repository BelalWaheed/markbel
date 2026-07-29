import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Sparkles,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MarkbelLogo from "../components/MarkbelLogo.js";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNative = navigator.userAgent.includes("Electron") || !!(window as any).ReactNativeWebView;

  const [ticktickConnected, setTicktickConnected] = useState(false);
  const [ticktickLoading, setTicktickLoading] = useState(true);
  const [ticktickProjects, setTicktickProjects] = useState<any[]>([]);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState("");

  useEffect(() => {
    if (searchParams.get("ticktick") === "connected") {
      setNoticeMessage("TickTick connected successfully!");
      setTimeout(() => setNoticeMessage(""), 4000);
    }
  }, [searchParams]);

  // Check TickTick status
  const loadTicktickStatus = async () => {
    try {
      const res = await api.get<{
        connected: boolean;
        defaultProjectId?: string;
      }>("/integrations/ticktick/status");
      setTicktickConnected(res.connected);
      if (res.connected) {
        try {
          const projs = await api.get<any[]>("/integrations/ticktick/projects");
          setTicktickProjects(projs);
        } catch (err) {
          console.warn("Failed to load TickTick projects:", err);
        }
      }
    } catch (err) {
      console.warn("Failed to load TickTick status:", err);
    } finally {
      setTicktickLoading(false);
    }
  };

  // Check Push status
  useEffect(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      ("PushManager" in window || "Notification" in window);
    setPushSupported(isSupported);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg.pushManager) {
            reg.pushManager.getSubscription().then((sub) => {
              setPushSubscribed(Boolean(sub));
            });
          }
        })
        .catch((err) => {
          console.warn("Service Worker registration check:", err);
        });
    }
    loadTicktickStatus();
  }, []);

  const handleConnectTickTick = async () => {
    try {
      const res = await api.get<{ url: string }>("/integrations/ticktick/auth");
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      alert(
        "Failed to initiate TickTick auth. Make sure TICKTICK_CLIENT_ID is configured.",
      );
    }
  };

  const handleDisconnectTickTick = async () => {
    if (!confirm("Disconnect TickTick account?")) return;
    setTicktickLoading(true);
    try {
      await api.delete("/integrations/ticktick");
      setTicktickConnected(false);
      setTicktickProjects([]);
    } catch (err) {
      console.error(err);
    } finally {
      setTicktickLoading(false);
    }
  };

  const handleSubscribePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Notification permission denied by browser");
        setPushLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidRes = await api.get<{ publicKey: string }>("/push/vapid-key");
      if (!vapidRes.publicKey) {
        alert("VAPID public key not set on backend environment");
        setPushLoading(false);
        return;
      }

      // Convert VAPID key to Uint8Array
      const padding = "=".repeat((4 - (vapidRes.publicKey.length % 4)) % 4);
      const base64 = (vapidRes.publicKey + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });

      const subObj = sub.toJSON();
      await api.post("/push/subscribe", {
        endpoint: subObj.endpoint,
        keys: subObj.keys,
        deviceLabel: navigator.userAgent.includes("Mobile")
          ? "Mobile Browser"
          : "Desktop Browser",
      });

      setPushSubscribed(true);
      setNoticeMessage("Push notifications enabled for this device!");
      setTimeout(() => setNoticeMessage(""), 4000);
    } catch (err: any) {
      console.error("Push registration error:", err);
      alert("Push setup failed: " + err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const handleUnsubscribePush = async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await api.delete("/push/unsubscribe", { endpoint: sub.endpoint });
      }
      setPushSubscribed(false);
    } catch (err) {
      console.error(err);
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setPushLoading(true);
    try {
      const res = await api.post<{ success: boolean; sent: number }>(
        "/push/send-test",
        {},
      );
      setNoticeMessage(`Test push sent successfully to ${res.sent} device(s)!`);
      setTimeout(() => setNoticeMessage(""), 4000);
    } catch (err: any) {
      alert("Failed to send test push: " + (err.message || "Unknown error"));
    } finally {
      setPushLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const appOrigin = window.location.origin;

  return (
    <div className="space-y-8 p-4 sm:p-6 md:p-8 max-w-4xl mx-auto pb-24 min-h-screen relative overflow-x-hidden text-[var(--color-text-primary)]">
      {/* Header */}
      <header className="studio-card px-5 py-4 flex items-center justify-between z-10 border border-[var(--color-border-default)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="btn-secondary p-2 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            title="Back to Bookmarks"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <MarkbelLogo size={32} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
              Settings & Integrations
            </h1>
            <p className="text-[10px] text-[var(--color-text-muted)] font-semibold tracking-wide uppercase">
              Configuration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs btn-danger px-3 py-1.5 rounded"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Notice Banner */}
      {noticeMessage && (
        <div className="studio-card p-4 border border-[var(--color-status-success)] bg-green-50 text-[var(--color-status-success)] text-sm font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* User Profile Card */}
      <section className="studio-card p-6 relative space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-3">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)] text-sm font-semibold tracking-wide">
            <UserIcon className="w-4 h-4 text-[var(--color-accent)]" />
            <span>User Account Identity</span>
          </div>
          <span className="text-[10px] text-[var(--color-text-primary)] bg-[var(--color-bg-element)] border border-[var(--color-border-default)] px-2 py-0.5 font-bold uppercase rounded-md">
            Active Session
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-bold mb-1">
              User Name
            </span>
            <span className="text-[var(--color-text-primary)] font-semibold">
              {user?.name}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-bold mb-1">
              Email Address
            </span>
            <span className="text-[var(--color-text-primary)] font-semibold">
              {user?.email}
            </span>
          </div>
        </div>
      </section>

      {/* TickTick Integration Card */}
      <section className="studio-card p-6 relative space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center font-bold rounded">
              ✓
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
                TickTick Integration
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Push bookmarks directly to your TickTick tasks & reminders list
              </p>
            </div>
          </div>

          <div>
            {ticktickLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
            ) : ticktickConnected ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-status-success)] bg-green-50 border border-green-200 px-2.5 py-1 rounded uppercase">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-element)] border border-[var(--color-border-default)] px-2.5 py-1 rounded-md uppercase">
                <XCircle className="w-3.5 h-3.5" />
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed font-medium">
            When connected, each bookmark card features a{" "}
            <strong>Push to TickTick</strong> button. Bookmarks push to a
            dedicated <strong>"Markbel"</strong> project by default, or any
            TickTick project you select.
          </p>

          {ticktickConnected && ticktickProjects.length > 0 && (
            <div className="bg-[var(--color-bg-element)] border border-[var(--color-border-default)] p-4 rounded-md space-y-2">
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider block">
                Connected TickTick Projects ({ticktickProjects.length})
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {ticktickProjects.map((p) => (
                  <span
                    key={p.id}
                    className="text-[11px] bg-white border border-[var(--color-border-default)] px-2.5 py-1 rounded-md text-[var(--color-text-primary)] font-medium shadow-sm"
                  >
                    📁 {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            {ticktickConnected ? (
              <button
                onClick={handleDisconnectTickTick}
                className="btn-danger px-4 py-2 rounded text-xs font-bold cursor-pointer"
              >
                Disconnect TickTick
              </button>
            ) : (
              <button
                onClick={handleConnectTickTick}
                className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Connect TickTick Account</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Web Push Notifications Card */}
      {!isNative && (
        <section className="studio-card p-6 relative space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center font-bold rounded">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
                Cross-Device Web Push
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Receive daily digests and due reminders on browser, mobile PWA,
                or desktop
              </p>
            </div>
          </div>

          <div>
            {pushSubscribed ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-status-success)] bg-green-50 border border-green-200 px-2.5 py-1 rounded uppercase">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Active Device</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded uppercase">
                <Clock className="w-3.5 h-3.5" />
                <span>Inactive</span>
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed font-medium">
            Enable browser Service Worker push notifications on this device to
            receive scheduled digest alerts and due bookmark reminders.
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            {pushSubscribed ? (
              <>
                <button
                  onClick={handleUnsubscribePush}
                  disabled={pushLoading}
                  className="btn-secondary px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  Disable Push On This Device
                </button>
                <button
                  onClick={handleTestPush}
                  disabled={pushLoading}
                  className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Send Test Push Now</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleSubscribePush}
                disabled={pushLoading || !pushSupported}
                className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                {pushLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                <span>
                  {pushSupported
                    ? "Enable Push Notifications"
                    : "Push Not Supported"}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
