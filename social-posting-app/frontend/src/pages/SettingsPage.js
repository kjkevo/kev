import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SettingsPage.css";
import { authAPI } from "../services/api";

const PLATFORMS = [
  {
    name: "TikTok",
    id: "tiktok",
    icon: "🎵",
    description: "Connect your TikTok account to post videos",
  },
  {
    name: "Instagram",
    id: "instagram",
    icon: "📷",
    description: "Connect your Instagram account to share Reels",
  },
  {
    name: "YouTube",
    id: "youtube",
    icon: "▶️",
    description: "Connect your YouTube account to post Shorts",
  },
  {
    name: "Facebook",
    id: "facebook",
    icon: "👥",
    description: "Connect your Facebook account to share videos",
  },
];

function SettingsPage({ user, setUser }) {
  const [platforms, setPlatforms] = useState({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlatforms();
  }, []);

  const fetchPlatforms = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getUserPlatforms(user.id);
      const platformMap = {};
      response.data.platforms.forEach((p) => {
        platformMap[p] = true;
      });
      setPlatforms(platformMap);
    } catch (error) {
      console.error("Failed to fetch platforms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPlatform = async (platformId) => {
    try {
      setConnecting(platformId);
      const response = await authAPI.getAuthUrl(platformId);
      const authUrl = response.data.auth_url;

      // Open OAuth flow in new window
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        "oauth-login",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for message from popup
      const handleMessage = async (event) => {
        if (
          event.origin !== window.location.origin ||
          event.data.type !== "oauth-callback"
        ) {
          return;
        }

        window.removeEventListener("message", handleMessage);

        if (event.data.success) {
          setPlatforms((prev) => ({ ...prev, [platformId]: true }));
        } else {
          alert(`Failed to connect ${platformId}: ${event.data.error}`);
        }

        setConnecting(null);
      };

      window.addEventListener("message", handleMessage);
    } catch (error) {
      console.error("Failed to connect platform:", error);
      alert("Failed to initiate connection");
      setConnecting(null);
    }
  };

  const handleDisconnectPlatform = async (platformId) => {
    if (
      window.confirm(`Are you sure you want to disconnect ${platformId}?`)
    ) {
      setPlatforms((prev) => ({ ...prev, [platformId]: false }));
      // TODO: Call API to revoke credentials
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <div className="settings-container">
      <div className="sidebar">
        <div className="logo">📱 Social Posting</div>
        <nav className="nav-menu">
          <a href="/" className="nav-link">
            📊 Dashboard
          </a>
          <a href="/create" className="nav-link">
            ➕ New Post
          </a>
          <a href="/settings" className="nav-link active">
            ⚙️ Settings
          </a>
        </nav>
      </div>

      <div className="main-content">
        <div className="page-header">
          <h1>Settings</h1>
          <p>Manage your platform connections and account</p>
        </div>

        <div className="settings-content">
          {/* Platform Connections */}
          <div className="settings-section">
            <h2>Connected Platforms</h2>
            <p className="section-description">
              Connect your social media accounts to start posting
            </p>

            {loading ? (
              <div className="loading-message">Loading platforms...</div>
            ) : (
              <div className="platforms-grid">
                {PLATFORMS.map((platform) => (
                  <div key={platform.id} className="platform-card">
                    <div className="platform-icon">{platform.icon}</div>
                    <h3>{platform.name}</h3>
                    <p>{platform.description}</p>

                    {platforms[platform.id] ? (
                      <div className="platform-connected">
                        <span className="status-badge connected">✓ Connected</span>
                        <button
                          onClick={() => handleDisconnectPlatform(platform.id)}
                          className="button button-danger"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConnectPlatform(platform.id)}
                        className="button button-primary"
                        disabled={connecting === platform.id}
                      >
                        {connecting === platform.id ? "Connecting..." : "Connect"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account Settings */}
          <div className="settings-section">
            <h2>Account</h2>
            <div className="account-info">
              <div className="info-item">
                <label>Email</label>
                <p>{user.email}</p>
              </div>
              <div className="info-item">
                <label>Member Since</label>
                <p>{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="danger-zone">
              <h3>Danger Zone</h3>
              <button onClick={handleLogout} className="button button-danger">
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
