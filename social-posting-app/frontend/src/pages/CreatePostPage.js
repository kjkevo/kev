import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/CreatePostPage.css";
import { postsAPI } from "../services/api";

const PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"];

function CreatePostPage({ user }) {
  const [searchParams] = useSearchParams();
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [captions, setCaptions] = useState({});
  const [scheduleTime, setScheduleTime] = useState("");
  const [postNow, setPostNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const postId = searchParams.get("id");
    if (postId) {
      // Load post for editing
      loadPost(postId);
    }
  }, [searchParams]);

  const loadPost = async (postId) => {
    // TODO: Load post data from API
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        setError("Please select a valid video file");
        return;
      }

      if (file.size > 5 * 1024 * 1024 * 1024) {
        // 5GB limit
        setError("Video file is too large (max 5GB)");
        return;
      }

      setVideoFile(file);
      setError("");

      // Create video preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlatformToggle = (platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );

    // Initialize caption for this platform
    if (!captions[platform]) {
      setCaptions((prev) => ({ ...prev, [platform]: "" }));
    }
  };

  const handleCaptionChange = (platform, text) => {
    setCaptions((prev) => ({ ...prev, [platform]: text }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!videoFile) {
        setError("Please select a video file");
        setLoading(false);
        return;
      }

      if (selectedPlatforms.length === 0) {
        setError("Please select at least one platform");
        setLoading(false);
        return;
      }

      // In a real app, you would upload the video file to a storage service
      // For now, we'll use a placeholder URL
      const videoUrl = videoPreview;

      const postData = {
        user_id: user.id,
        video_url: videoUrl,
        captions: captions,
        platforms: selectedPlatforms,
        scheduled_for: postNow ? null : scheduleTime,
      };

      await postsAPI.createPost(postData);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-container">
      <div className="sidebar">
        <div className="logo">📱 Social Posting</div>
        <nav className="nav-menu">
          <a href="/" className="nav-link">
            📊 Dashboard
          </a>
          <a href="/create" className="nav-link active">
            ➕ New Post
          </a>
          <a href="/settings" className="nav-link">
            ⚙️ Settings
          </a>
        </nav>
      </div>

      <div className="main-content">
        <div className="page-header">
          <h1>Create New Post</h1>
          <p>Upload a video and post it to multiple platforms</p>
        </div>

        <form onSubmit={handleSubmit} className="create-form">
          {error && <div className="error-banner">{error}</div>}

          {/* Video Upload Section */}
          <div className="form-section">
            <h2>Step 1: Upload Video</h2>

            <div className="video-upload">
              {videoPreview ? (
                <div className="video-preview">
                  <video controls width="100%">
                    <source src={videoPreview} type={videoFile.type} />
                    Your browser does not support the video tag.
                  </video>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreview(null);
                    }}
                    className="button button-secondary"
                  >
                    Change Video
                  </button>
                </div>
              ) : (
                <label className="upload-box">
                  <div className="upload-content">
                    <span className="upload-icon">📹</span>
                    <p>Click to upload or drag and drop</p>
                    <p className="upload-hint">MP4, MOV, AVI (max 5GB)</p>
                  </div>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoChange}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Platforms Section */}
          <div className="form-section">
            <h2>Step 2: Select Platforms</h2>
            <div className="platform-selector">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={`platform-option ${
                    selectedPlatforms.includes(platform) ? "selected" : ""
                  }`}
                  onClick={() => handlePlatformToggle(platform)}
                >
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Captions Section */}
          {selectedPlatforms.length > 0 && (
            <div className="form-section">
              <h2>Step 3: Add Captions</h2>
              <p className="section-description">
                Customize captions for each platform or use the same for all
              </p>

              <div className="captions-grid">
                {selectedPlatforms.map((platform) => (
                  <div key={platform} className="caption-input">
                    <label htmlFor={`caption-${platform}`}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </label>
                    <textarea
                      id={`caption-${platform}`}
                      value={captions[platform] || ""}
                      onChange={(e) => handleCaptionChange(platform, e.target.value)}
                      placeholder={`Enter caption for ${platform}...`}
                      maxLength="1000"
                    />
                    <p className="char-count">
                      {(captions[platform] || "").length}/1000
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="copy-button"
                onClick={() => {
                  const firstCaption = captions[selectedPlatforms[0]] || "";
                  const newCaptions = { ...captions };
                  selectedPlatforms.forEach((p) => {
                    newCaptions[p] = firstCaption;
                  });
                  setCaptions(newCaptions);
                }}
              >
                Use same caption for all
              </button>
            </div>
          )}

          {/* Scheduling Section */}
          <div className="form-section">
            <h2>Step 4: Publish</h2>

            <div className="publish-options">
              <label className="radio-option">
                <input
                  type="radio"
                  checked={postNow}
                  onChange={() => setPostNow(true)}
                />
                <span>Post immediately</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  checked={!postNow}
                  onChange={() => setPostNow(false)}
                />
                <span>Schedule for later</span>
              </label>
            </div>

            {!postNow && (
              <div className="form-group">
                <label htmlFor="schedule-time">Schedule Time</label>
                <input
                  id="schedule-time"
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  required={!postNow}
                />
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={loading}>
              {loading ? "Creating post..." : "Create Post"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="button button-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePostPage;
