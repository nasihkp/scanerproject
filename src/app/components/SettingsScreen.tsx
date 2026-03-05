import { ArrowLeft, Moon, Image, FileType, HelpCircle, Info, User, LogOut, Cloud, FileText } from 'lucide-react';
import { useAuth } from "../hooks/useAuth";

interface SettingsScreenProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onBack: () => void;
  onMergePdf: () => void;
}

export function SettingsScreen({ isDarkMode, onToggleDarkMode, onBack, onMergePdf }: SettingsScreenProps) {
  const { user, signOut, signInWithGoogle } = useAuth();

  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      await signOut();
      onBack(); // Go back to home/login
    }
  };

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 dark:text-gray-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h2 className="font-semibold text-gray-900 dark:text-white">Settings</h2>

        <button className="w-8"></button>
      </div>

      {/* Settings list */}
      <div className="flex-1 overflow-y-auto">
        {/* Account Section */}
        <div className="mt-6 px-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Account</h3>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {user ? (
              <>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-4">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-16 h-16 rounded-full border-2 border-gray-100 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
                      <User className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white text-lg truncate">{user.displayName}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full w-fit">
                      <Cloud className="w-3 h-3" />
                      <span>Google Drive Connected</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 p-4 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="p-4 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <User className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Not Signed In</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Sign in to sync your documents with Google Drive
                </p>
                <button
                  onClick={() => signInWithGoogle()}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                >
                  Sign In with Google
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Appearance section */}
        <div className="mt-6 px-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Appearance</h3>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Dark Mode</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Switch to dark theme</p>
                </div>
              </div>

              <button
                onClick={onToggleDarkMode}
                className={`relative w-12 h-7 rounded-full transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                ></div>
              </button>
            </div>
          </div>
        </div>

        {/* Scan settings section */}
        <div className="mt-6 px-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Scan Settings</h3>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Image className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Scan Quality</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">High quality</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <FileType className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Default PDF Size</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">A4</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button
              onClick={onMergePdf}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Merge PDFs</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Combine multiple documents</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

        {/* About section */}
        <div className="mt-6 px-5 pb-6">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">About</h3>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Help & Support</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Get help using SmartScan</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Info className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">About SmartScan</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Version 1.0.0</p>
                </div>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>
      </div >
    </div >
  );
}
