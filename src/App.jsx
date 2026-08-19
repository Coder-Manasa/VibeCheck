import { useState } from "react";
import Sentiment from "sentiment";
import "./App.css";

const sentiment = new Sentiment();

/* =========================================================
   SENTIMENT ANALYSIS
========================================================= */

function analyzeSentiment(title, text = "") {
  const combinedText = `${title || ""} ${text || ""}`.trim();
  const result = sentiment.analyze(combinedText);

  let label = "Neutral";

  if (result.score > 0) {
    label = "Positive";
  } else if (result.score < 0) {
    label = "Negative";
  }

  return {
    label,
    score: result.score,
  };
}

function getSentimentEmoji(type) {
  if (type === "Positive") return "😊";
  if (type === "Negative") return "😞";
  return "😐";
}

function getMoodMessage(positive, neutral, negative) {
  if (positive > neutral && positive > negative) {
    return "The community has a positive overall mood.";
  }

  if (negative > positive && negative > neutral) {
    return "The community has a mostly negative overall mood.";
  }

  if (neutral >= positive && neutral >= negative) {
    return "The community has a balanced overall mood.";
  }

  return "The community has a mixed overall mood.";
}

/* =========================================================
   TIME FORMATTER
========================================================= */

function formatTime(dateString) {
  if (!dateString) {
    return "Unknown time";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const now = new Date();
  const difference = Math.max(0, now.getTime() - date.getTime());

  const minutes = Math.floor(difference / (1000 * 60));
  const hours = Math.floor(difference / (1000 * 60 * 60));
  const days = Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString();
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [subreddit, setSubreddit] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("default");

  /* =======================================================
     FETCH + ANALYZE SUBREDDIT
  ======================================================= */

  const analyzePosts = async () => {
    const input = subreddit.trim();

    if (!input) {
      setError("Please enter a subreddit name.");
      return;
    }

    setLoading(true);
    setSearched(false);
    setError("");
    setFilter("All");
    setSortOrder("default");

    try {
      const cleanSubreddit = input.replace(/^r\//i, "").trim();

      if (!cleanSubreddit) {
        throw new Error("Invalid subreddit name");
      }
      const response = await fetch(
        `https://vibecheck-khhu.onrender.com/api/subreddit/${encodeURIComponent(cleanSubreddit)}`
      );

      if (!response.ok) {
        throw new Error(
          `Unable to fetch subreddit (${response.status})`
        );
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.posts)) {
        throw new Error("Invalid response from server");
      }

      if (data.posts.length === 0) {
        throw new Error("No posts found");
      }

      const analyzedPosts = data.posts.map((post, index) => {
        const safePost = post || {};

        const analysis = analyzeSentiment(
          safePost.title || "",
          safePost.text || safePost.selftext || ""
        );

        return {
          ...safePost,
          id:
            safePost.id ||
            safePost.name ||
            `post-${index}`,
          title:
            safePost.title ||
            "Untitled Reddit post",
          text:
            safePost.text ||
            safePost.selftext ||
            "",
          author:
            safePost.author ||
            "Reddit user",
          score:
            typeof safePost.score === "number"
              ? safePost.score
              : Number(safePost.score) || 0,
          created:
            safePost.created ||
            safePost.created_utc ||
            null,
          url:
            safePost.url ||
            safePost.permalink ||
            "",
          sentiment: analysis.label,
          sentimentScore: analysis.score,
        };
      });

      setSubreddit(cleanSubreddit);
      setPosts(analyzedPosts);
      setSearched(true);
    } catch (err) {
      console.error("VibeCheck error:", err);

      setPosts([]);
      setSearched(false);

      setError(
        err?.message === "No posts found"
          ? "No posts were found for this subreddit."
          : "Unable to fetch this subreddit. Please check the name and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     SENTIMENT COUNTS
  ======================================================= */

  const positive = posts.filter(
    (post) => post.sentiment === "Positive"
  ).length;

  const neutral = posts.filter(
    (post) => post.sentiment === "Neutral"
  ).length;

  const negative = posts.filter(
    (post) => post.sentiment === "Negative"
  ).length;

  const totalPosts = posts.length;

  /* =======================================================
     PERCENTAGES
  ======================================================= */

  const positivePercent =
    totalPosts > 0
      ? Math.round((positive / totalPosts) * 100)
      : 0;

  const neutralPercent =
    totalPosts > 0
      ? Math.round((neutral / totalPosts) * 100)
      : 0;

  const negativePercent =
    totalPosts > 0
      ? Math.round((negative / totalPosts) * 100)
      : 0;

  /* =======================================================
     OVERALL MOOD
  ======================================================= */

  let overallMood = "Neutral";

  if (positive > neutral && positive > negative) {
    overallMood = "Positive";
  } else if (
    negative > positive &&
    negative > neutral
  ) {
    overallMood = "Negative";
  }

  let moodMessage = "";

  if (overallMood === "Positive") {
    moodMessage =
      "The community is generally positive and appears to be responding well to recent discussions.";
  } else if (overallMood === "Negative") {
    moodMessage =
      "The community has a mostly negative mood, with several discussions showing dissatisfaction.";
  } else {
    moodMessage =
      "The community has a balanced overall mood with a mix of positive, neutral, and negative discussions.";
  }

  /* =======================================================
     MOST POSITIVE / NEGATIVE POSTS
  ======================================================= */

  const positivePosts = posts.filter(
    (post) => post.sentiment === "Positive"
  );

  const negativePosts = posts.filter(
    (post) => post.sentiment === "Negative"
  );

  const mostPositivePost =
    positivePosts.length > 0
      ? positivePosts.reduce((best, current) =>
          current.sentimentScore > best.sentimentScore
            ? current
            : best
        )
      : null;

  const mostNegativePost =
    negativePosts.length > 0
      ? negativePosts.reduce((best, current) =>
          current.sentimentScore < best.sentimentScore
            ? current
            : best
        )
      : null;

  /* =======================================================
     FILTER POSTS
  ======================================================= */

  const filteredPosts =
    filter === "All"
      ? posts
      : posts.filter(
          (post) => post.sentiment === filter
        );

  /* =======================================================
     SORT POSTS
  ======================================================= */

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortOrder === "recent") {
      return (
        new Date(b.created || 0).getTime() -
        new Date(a.created || 0).getTime()
      );
    }

    if (sortOrder === "positive") {
      return (
        (b.sentimentScore || 0) -
        (a.sentimentScore || 0)
      );
    }

    if (sortOrder === "negative") {
      return (
        (a.sentimentScore || 0) -
        (b.sentimentScore || 0)
      );
    }

    if (sortOrder === "score") {
      return (
        (b.score || 0) -
        (a.score || 0)
      );
    }

    return 0;
  });

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="header">
        <div className="logo">
          <span className="logo-icon">V</span>
          <span>VibeCheck</span>
        </div>

        <span className="header-badge">
          Reddit Community Analyzer
        </span>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="container">

        {/* =================================================
            HERO
        ================================================= */}

        <section className="hero">

          <div className="hero-badge">
            ✨ AI-powered community insights
          </div>

          <h1>
            The Subreddit
            <span> Vibe Check</span>
          </h1>

          <p>
            Discover the mood of any Reddit community by
            analyzing the sentiment of its hottest posts.
          </p>

          {/* SEARCH */}

          <div className="search-box">

            <span className="search-icon">
              🔍
            </span>

            <input
              type="text"
              placeholder="Enter a subreddit, e.g. programming"
              value={subreddit}
              disabled={loading}
              onChange={(e) => {
                setSubreddit(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  analyzePosts();
                }
              }}
            />

            <button
              type="button"
              onClick={analyzePosts}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Analyzing...
                </>
              ) : (
                "Check Vibe"
              )}
            </button>

          </div>

          <p className="hint">
            Try: programming · technology · javascript · gaming
          </p>

          {/* ERROR */}

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

        </section>

        {/* =================================================
            RESULTS
        ================================================= */}

        {searched && (
          <>

            {/* =================================================
                COMMUNITY HEADER
            ================================================= */}

            <section className="community-heading">

              <div>
                <span className="community-label">
                  COMMUNITY VIBE
                </span>

                <h2>
                  r/{subreddit}
                </h2>
              </div>

              <div className="post-count">
                {posts.length} posts analyzed
              </div>

            </section>

            {/* =================================================
                STATS
            ================================================= */}

            <section className="stats">

              {/* POSITIVE */}

              <div className="stat-card positive-card">

                <div className="stat-icon">
                  😊
                </div>

                <div>
                  <p>Positive</p>

                  <strong>
                    {positive}
                  </strong>

                  <span>
                    {positivePercent}%
                  </span>
                </div>

              </div>

              {/* NEUTRAL */}

              <div className="stat-card neutral-card">

                <div className="stat-icon">
                  😐
                </div>

                <div>
                  <p>Neutral</p>

                  <strong>
                    {neutral}
                  </strong>

                  <span>
                    {neutralPercent}%
                  </span>
                </div>

              </div>

              {/* NEGATIVE */}

              <div className="stat-card negative-card">

                <div className="stat-icon">
                  😞
                </div>

                <div>
                  <p>Negative</p>

                  <strong>
                    {negative}
                  </strong>

                  <span>
                    {negativePercent}%
                  </span>
                </div>

              </div>

            </section>

            {/* =================================================
                OVERALL VIBE
            ================================================= */}

            <section className="vibe-card">

              <div className="section-title">

                <div>
                  <h3>
                    Overall Vibe
                  </h3>

                  <span>
                    Sentiment breakdown
                  </span>
                </div>

                <div
                  className={`mood-badge ${overallMood.toLowerCase()}`}
                >
                  {getSentimentEmoji(overallMood)}{" "}
                  {overallMood}
                </div>

              </div>

              <div className="mood-message">
                {getMoodMessage(
                  positive,
                  neutral,
                  negative
                )}
              </div>

              <div className="vibe-content">

                {/* MOOD CIRCLE */}

                <div className="vibe-circle">
                  <div>
                    <strong>
                      {overallMood}
                    </strong>

                    <span>
                      Overall mood
                    </span>
                  </div>
                </div>

                {/* BREAKDOWN */}

                <div className="breakdown">

                  {/* POSITIVE */}

                  <div className="breakdown-row">

                    <div className="breakdown-label">
                      <span className="dot positive"></span>

                      <span>
                        Positive
                      </span>
                    </div>

                    <strong>
                      {positivePercent}%
                    </strong>

                  </div>

                  <div className="progress">
                    <div
                      className="progress-positive"
                      style={{
                        width: `${positivePercent}%`,
                      }}
                    ></div>
                  </div>

                  {/* NEUTRAL */}

                  <div className="breakdown-row">

                    <div className="breakdown-label">
                      <span className="dot neutral"></span>

                      <span>
                        Neutral
                      </span>
                    </div>

                    <strong>
                      {neutralPercent}%
                    </strong>

                  </div>

                  <div className="progress">
                    <div
                      className="progress-neutral"
                      style={{
                        width: `${neutralPercent}%`,
                      }}
                    ></div>
                  </div>

                  {/* NEGATIVE */}

                  <div className="breakdown-row">

                    <div className="breakdown-label">
                      <span className="dot negative"></span>

                      <span>
                        Negative
                      </span>
                    </div>

                    <strong>
                      {negativePercent}%
                    </strong>

                  </div>

                  <div className="progress">
                    <div
                      className="progress-negative"
                      style={{
                        width: `${negativePercent}%`,
                      }}
                    ></div>
                  </div>

                </div>

              </div>

            </section>

            {/* =================================================
                COMMUNITY INSIGHTS
            ================================================= */}

            <section className="insights-card">

              <div className="section-title">

                <div>
                  <h3>
                    Community Insights
                  </h3>

                  <span>
                    Automated analysis of community discussions
                  </span>
                </div>

                <div className="insights-badge">
                  🧠 Smart Analysis
                </div>

              </div>

              {/* MAIN MOOD */}

              <div className="insight-main">

                <div className="mood-box">

                  <div className="mood-icon">
                    {overallMood === "Positive" && "😊"}
                    {overallMood === "Neutral" && "😐"}
                    {overallMood === "Negative" && "😞"}
                  </div>

                  <div>

                    <span className="insight-label">
                      OVERALL COMMUNITY MOOD
                    </span>

                    <h2>
                      {overallMood}
                    </h2>

                    <p>
                      {moodMessage}
                    </p>

                  </div>

                </div>

              </div>

              {/* SENTIMENT DISTRIBUTION */}

              <div className="insight-distribution">

                <h4>
                  Sentiment Distribution
                </h4>

                {/* POSITIVE */}

                <div className="distribution-row">

                  <div className="distribution-label">
                    <span>
                      😊 Positive
                    </span>

                    <strong>
                      {positivePercent}%
                    </strong>
                  </div>

                  <div className="distribution-bar">
                    <div
                      className="distribution-fill positive-fill"
                      style={{
                        width: `${positivePercent}%`,
                      }}
                    ></div>
                  </div>

                </div>

                {/* NEUTRAL */}

                <div className="distribution-row">

                  <div className="distribution-label">
                    <span>
                      😐 Neutral
                    </span>

                    <strong>
                      {neutralPercent}%
                    </strong>
                  </div>

                  <div className="distribution-bar">
                    <div
                      className="distribution-fill neutral-fill"
                      style={{
                        width: `${neutralPercent}%`,
                      }}
                    ></div>
                  </div>

                </div>

                {/* NEGATIVE */}

                <div className="distribution-row">

                  <div className="distribution-label">
                    <span>
                      😞 Negative
                    </span>

                    <strong>
                      {negativePercent}%
                    </strong>
                  </div>

                  <div className="distribution-bar">
                    <div
                      className="distribution-fill negative-fill"
                      style={{
                        width: `${negativePercent}%`,
                      }}
                    ></div>
                  </div>

                </div>

              </div>

              {/* KEY INSIGHTS */}

              <div className="key-insights">

                {/* MOST POSITIVE */}

                <div className="key-insight">

                  <span className="key-icon positive-key">
                    😊
                  </span>

                  <div>

                    <span className="key-label">
                      Most Positive
                    </span>

                    <p>
                      {mostPositivePost
                        ? mostPositivePost.title
                        : "No positive posts found"}
                    </p>

                  </div>

                </div>

                {/* MOST NEGATIVE */}

                <div className="key-insight">

                  <span className="key-icon negative-key">
                    😞
                  </span>

                  <div>

                    <span className="key-label">
                      Most Negative
                    </span>

                    <p>
                      {mostNegativePost
                        ? mostNegativePost.title
                        : "No negative posts found"}
                    </p>

                  </div>

                </div>

              </div>

            </section>

            {/* =================================================
                HOT POSTS
            ================================================= */}

            <section className="posts-card">

              <div className="posts-header">

                <div>
                  <h3>
                    Hot Posts
                  </h3>

                  <span>
                    {filteredPosts.length} of{" "}
                    {posts.length} posts shown
                  </span>
                </div>

                {/* FILTERS */}

                <div className="filters">

                  <button
                    type="button"
                    className={
                      filter === "All"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setFilter("All")
                    }
                  >
                    All
                  </button>

                  <button
                    type="button"
                    className={
                      filter === "Positive"
                        ? "active positive"
                        : ""
                    }
                    onClick={() =>
                      setFilter("Positive")
                    }
                  >
                    😊 Positive
                  </button>

                  <button
                    type="button"
                    className={
                      filter === "Neutral"
                        ? "active neutral"
                        : ""
                    }
                    onClick={() =>
                      setFilter("Neutral")
                    }
                  >
                    😐 Neutral
                  </button>

                  <button
                    type="button"
                    className={
                      filter === "Negative"
                        ? "active negative"
                        : ""
                    }
                    onClick={() =>
                      setFilter("Negative")
                    }
                  >
                    😞 Negative
                  </button>

                </div>

                {/* SORTING */}

                <div className="sort-wrapper">

                  <label htmlFor="post-sort">
                    Sort by
                  </label>

                  <select
                    id="post-sort"
                    className="sort-select"
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value)
                    }
                  >
                    <option value="default">
                      Default order
                    </option>

                    <option value="recent">
                      Most recent
                    </option>

                    <option value="positive">
                      Most positive
                    </option>

                    <option value="negative">
                      Most negative
                    </option>

                    <option value="score">
                      Highest score
                    </option>
                  </select>

                </div>

              </div>

              {/* POSTS */}

              <div className="posts-list">

                {sortedPosts.length > 0 ? (

                  sortedPosts.map((post, index) => (

                    <article
                      className="post"
                      key={
                        post.id ||
                        post.name ||
                        `post-${index}`
                      }
                    >

                      {/* RANK */}

                      <div className="post-rank">
                        #{index + 1}
                      </div>

                      {/* SCORE */}

                      <div className="post-score">

                        <span>
                          ↑
                        </span>

                        <strong>
                          {typeof post.score ===
                            "number"
                            ? post.score.toLocaleString()
                            : "—"}
                        </strong>

                      </div>

                      {/* CONTENT */}

                      <div className="post-content">

                        {post.url ? (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="post-title"
                          >
                            {post.title}
                          </a>
                        ) : (
                          <h4 className="post-title">
                            {post.title}
                          </h4>
                        )}

                        {/* META */}

                        <div className="post-meta">

                          <span>
                            👤{" "}
                            {post.author ||
                              "Reddit user"}
                          </span>

                          <span>
                            🕐{" "}
                            {formatTime(
                              post.created
                            )}
                          </span>

                        </div>

                        {/* BOTTOM */}

                        <div className="post-bottom">

                          <span
                            className={`sentiment ${
                              post.sentiment
                                ? post.sentiment.toLowerCase()
                                : "neutral"
                            }`}
                          >
                            {getSentimentEmoji(
                              post.sentiment
                            )}{" "}
                            {post.sentiment ||
                              "Neutral"}
                          </span>

                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="reddit-link"
                            >
                              View on Reddit ↗
                            </a>
                          )}

                        </div>

                      </div>

                    </article>

                  ))

                ) : (

                  <div className="no-posts">

                    <div>
                      🔎
                    </div>

                    <h4>
                      No posts found
                    </h4>

                    <p>
                      There are no posts matching
                      this sentiment filter.
                    </p>

                  </div>

                )}

              </div>

            </section>

          </>
        )}

        {/* =================================================
            EMPTY STATE
        ================================================= */}

        {!searched &&
          !loading &&
          !error && (

            <section className="empty-state">

              <div className="empty-icon">
                🌐
              </div>

              <h2>
                Ready to check the vibe?
              </h2>

              <p>
                Enter a subreddit above to discover
                what the community is talking about.
              </p>

            </section>

          )}

        {/* =================================================
            LOADING STATE
        ================================================= */}

        {loading && (
          <section className="empty-state loading-state">

            <div className="empty-icon">
              🧠
            </div>

            <h2>
              Analyzing the community...
            </h2>

            <p>
              Fetching Reddit posts and checking
              their sentiment.
            </p>

          </section>
        )}

      </main>

      {/* =================================================
          FOOTER
      ================================================= */}

      <footer>

        <p>
          The Subreddit Vibe Check · Built with React,
          Express & sentiment analysis
        </p>

      </footer>

    </div>
  );
}

export default App;