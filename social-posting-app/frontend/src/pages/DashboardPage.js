import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/DashboardPage.css";
import { postsAPI } from "../services/api";

function DashboardPage({ user }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, [filter]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const status = filter === "all" ? null : filter;
      const response = await postsAPI.getUserPosts(user.id, status);
      setPosts(response.data.posts);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
      try {
        await postsAPI.deletePost(postId);
        setPosts(posts.filter((p) => p.id !== postId));
      } catch (error) {
        console.error("Failed to delete post:", error);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div className="logo">📱 Social Posting</div>
        <nav className="nav-menu">
          <Link to="/" className="nav-link active">
            📊 Dashboard
          </Link>
          <Link to="/create" className="nav-link">
            ➕ New Post
          </Link>
          <Link to="/settings" className="nav-link">
            ⚙️ Settings
          </Link>
        </nav>
        <div className="user-section">
          <div className="user-info">
            <p>{user.email}</p>
          </div>
          <button onClick={handleLogout} className="button button-secondary">
            Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Manage your social media posts</p>
        </div>

        <div className="content-section">
          <div className="filter-bar">
            <button
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Posts
            </button>
            <button
              className={`filter-btn ${filter === "draft" ? "active" : ""}`}
              onClick={() => setFilter("draft")}
            >
              Drafts
            </button>
            <button
              className={`filter-btn ${filter === "scheduled" ? "active" : ""}`}
              onClick={() => setFilter("scheduled")}
            >
              Scheduled
            </button>
            <button
              className={`filter-btn ${filter === "posted" ? "active" : ""}`}
              onClick={() => setFilter("posted")}
            >
              Posted
            </button>
          </div>

          {loading ? (
            <div className="loading-message">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <h2>No posts yet</h2>
              <p>Create your first post to get started</p>
              <Link to="/create" className="button button-primary">
                Create Post
              </Link>
            </div>
          ) : (
            <div className="posts-list">
              {posts.map((post) => (
                <div key={post.id} className="post-item">
                  <div className="post-item-header">
                    <div>
                      <h3 className="post-item-title">
                        {post.captions[post.platforms[0]] || "Untitled Post"}
                      </h3>
                      <div className="post-item-meta">
                        Created: {new Date(post.created_at).toLocaleDateString()}
                        {post.scheduled_for &&
                          ` • Scheduled: ${new Date(post.scheduled_for).toLocaleString()}`}
                      </div>
                    </div>
                    <span className={`post-item-status status-${post.status}`}>
                      {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                    </span>
                  </div>

                  <div className="post-item-platforms">
                    {post.platforms.map((platform) => (
                      <span key={platform} className="platform-badge">
                        {platform}
                      </span>
                    ))}
                  </div>

                  {post.error_message && (
                    <div className="error-text">{post.error_message}</div>
                  )}

                  <div className="post-item-actions">
                    {post.status === "draft" && (
                      <Link to={`/create?id=${post.id}`} className="button button-secondary">
                        Edit
                      </Link>
                    )}
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="button button-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
