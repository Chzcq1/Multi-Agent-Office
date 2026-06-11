import { useState, useEffect, useCallback } from "react";
import { Task, UserProfile, listTasks, getProfile } from "./lib/api";
import { AppSettings, loadSettings, saveSettings } from "./lib/settings";
import Sidebar from "./components/Sidebar";
import BoardroomChat from "./components/BoardroomChat";
import ProfileModal from "./components/ProfileModal";
import SettingsModal from "./components/SettingsModal";
import { Settings, Menu } from "lucide-react";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bootstrap = useCallback(async () => {
    try {
      const [taskData, profileData] = await Promise.all([listTasks(), getProfile()]);
      setTasks(taskData);
      setProfile(profileData);
      if (!profileData) setShowProfileModal(true);
    } catch {
      setShowProfileModal(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  function handleSelectTask(id: number) {
    if (isProcessing) return;
    setActiveTaskId(id);
    setIsNew(false);
    setSidebarOpen(false);
  }

  function handleNewTask() {
    if (isProcessing) return;
    setActiveTaskId(null);
    setIsNew(true);
    setSidebarOpen(false);
  }

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [task, ...prev]);
    setActiveTaskId(task.id);
    setIsNew(false);
  }

  function handleTaskUpdated(task: Task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }

  function handleTaskDeleted(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (activeTaskId === id) { setActiveTaskId(null); setIsNew(false); }
  }

  function handleProfileComplete(newProfile: UserProfile) {
    setProfile(newProfile);
    setShowProfileModal(false);
  }

  function handleSettingsSave(newSettings: AppSettings) {
    setAppSettings(newSettings);
    saveSettings(newSettings);
  }

  return (
    <div className="flex h-dvh bg-gray-50 overflow-hidden">

      {showProfileModal && (
        <ProfileModal onComplete={handleProfileComplete} existing={profile} />
      )}

      {showSettingsModal && (
        <SettingsModal
          settings={appSettings}
          onSave={handleSettingsSave}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Sidebar — hidden on mobile until toggled */}
      <Sidebar
        tasks={tasks}
        activeTaskId={activeTaskId}
        profile={profile}
        onSelectTask={handleSelectTask}
        onNewTask={handleNewTask}
        onTaskDeleted={handleTaskDeleted}
        onEditProfile={() => setShowProfileModal(true)}
        isProcessing={isProcessing}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex-shrink-0 h-12 bg-white border-b border-gray-100 flex items-center px-3 sm:px-5 gap-2">
          {/* Hamburger — tablet/mobile (<1024px) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="เปิดเมนู"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-base">🏛️</span>
            <span className="font-semibold text-gray-800 text-sm hidden xs:inline">ห้องประชุมกลยุทธ์ AI</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {profile && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
                <span>{profile.avatarEmoji}</span>
                <span className="font-medium text-gray-700 text-xs">{profile.displayName}</span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-400 text-xs">{profile.role}</span>
              </div>
            )}
            {appSettings.geminiKey && (
              <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full border border-emerald-100">
                🔑 <span className="hidden sm:inline">Custom Key</span>
              </span>
            )}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors border border-gray-200"
              title="ตั้งค่าระบบ"
            >
              <Settings size={13} />
              <span className="hidden sm:inline">ตั้งค่า</span>
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white overflow-hidden flex flex-col min-h-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">กำลังโหลด...</p>
              </div>
            </div>
          ) : (
            <BoardroomChat
              task={activeTask}
              profile={profile}
              settings={appSettings}
              onProcessingChange={setIsProcessing}
              onTaskCreated={handleTaskCreated}
              onTaskUpdated={handleTaskUpdated}
              isNew={isNew}
            />
          )}
        </div>
      </main>
    </div>
  );
}
