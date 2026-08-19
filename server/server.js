const express = require("express");
const cors = require("cors");
const axios = require("axios");
const Parser = require("rss-parser");

const app = express();
const parser = new Parser();

const PORT = 5000;

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json());

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "VibeCheck backend is running 🚀",
  });
});

/* =========================================================
   SENTIMENT ANALYSIS
========================================================= */

function analyzeSentiment(text = "") {
  const value = text.toLowerCase();

  const positiveWords = [
    "love",
    "great",
    "good",
    "awesome",
    "amazing",
    "excellent",
    "best",
    "happy",
    "helpful",
    "useful",
    "nice",
    "wonderful",
    "fantastic",
    "perfect",
    "enjoy",
    "enjoyed",
    "excited",
    "success",
    "successful",
    "win",
    "winning",
    "thank",
    "thanks",
    "recommend",
    "recommendation",
    "cool",
    "fun",
    "impressive",
    "beautiful",
    "interesting",
  ];

  const negativeWords = [
    "bad",
    "hate",
    "terrible",
    "awful",
    "worst",
    "horrible",
    "sad",
    "angry",
    "annoying",
    "annoyed",
    "useless",
    "problem",
    "problems",
    "issue",
    "issues",
    "fail",
    "failed",
    "failure",
    "broken",
    "wrong",
    "disappointing",
    "disappointed",
    "disaster",
    "scam",
    "scammed",
    "trash",
    "toxic",
    "boring",
    "frustrating",
    "frustrated",
    "ridiculous",
    "stupid",
    "hate",
    "waste",
  ];

  let score = 0;

  positiveWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = value.match(regex);

    if (matches) {
      score += matches.length;
    }
  });

  negativeWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = value.match(regex);

    if (matches) {
      score -= matches.length;
    }
  });

  let label = "Neutral";

  if (score > 0) {
    label = "Positive";
  } else if (score < 0) {
    label = "Negative";
  }

  return {
    label,
    score,
  };
}

/* =========================================================
   CLEAN TEXT
========================================================= */

function cleanText(text = "") {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   FETCH REDDIT RSS
========================================================= */

async function fetchRedditPosts(subreddit) {
  const redditUrl =
    `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.rss?limit=50`;
  console.log("");
  console.log("======================================");
  console.log(`Fetching r/${subreddit}`);
  console.log("======================================");
  console.log(`URL: ${redditUrl}`);

  try {
    const response = await axios.get(redditUrl, {
      headers: {
        "User-Agent":
          "VibeCheck/1.0 by VibeCheckApp",
        Accept:
          "application/rss+xml, application/xml, text/xml",
      },

      timeout: 15000,
    });

    console.log(
      `Reddit response: ${response.status}`
    );

    if (!response.data) {
      throw new Error(
        "Reddit returned an empty response."
      );
    }

    const feed = await parser.parseString(
      response.data
    );

    console.log(
      `RSS items received: ${feed.items.length}`
    );

    return feed.items;

  } catch (error) {
    console.error("");

    if (error.response) {
      console.error(
        "Reddit status:",
        error.response.status
      );

      console.error(
        "Reddit message:",
        error.response.statusText
      );
    } else {
      console.error(
        "Reddit request error:",
        error.message
      );
    }

    throw error;
  }
}

/* =========================================================
   CONVERT REDDIT RSS ITEM
========================================================= */

function formatRedditPost(item, index, subreddit) {
  const title =
    cleanText(item.title) ||
    "Untitled Reddit post";

  const content =
    cleanText(
      item.content ||
        item.summary ||
        ""
    );

  const combinedText =
    `${title} ${content}`.trim();

  const analysis =
    analyzeSentiment(combinedText);

  /* -------------------------------------------------------
     Extract Reddit post ID
  ------------------------------------------------------- */

  let postId = `post-${index}`;

  if (item.id) {
    const parts =
      item.id.split("/");

    const lastPart =
      parts[parts.length - 1];

    if (lastPart) {
      postId = lastPart;
    }
  }

  /* -------------------------------------------------------
     Author
  ------------------------------------------------------- */

  let author = "Reddit user";

  if (item.author) {
    if (typeof item.author === "string") {
      author = item.author;
    } else if (item.author.name) {
      author = item.author.name;
    }
  }

  author = author
    .replace(/^\/u\//i, "")
    .trim();

  /* -------------------------------------------------------
     URL
  ------------------------------------------------------- */

  let url = "";

  if (item.link) {
    url = item.link;
  }

  /* -------------------------------------------------------
     Created date
  ------------------------------------------------------- */

  let created = null;

  if (item.pubDate) {
    const date =
      new Date(item.pubDate);

    if (!Number.isNaN(date.getTime())) {
      created =
        date.toISOString();
    }
  } else if (item.isoDate) {
    const date =
      new Date(item.isoDate);

    if (!Number.isNaN(date.getTime())) {
      created =
        date.toISOString();
    }
  }

  /* -------------------------------------------------------
     Score
     
     RSS does not reliably expose Reddit score.
     We use 0 when unavailable.
  ------------------------------------------------------- */

  const score = 0;

  return {
    id: postId,

    name: postId,

    title,

    text: content,

    author,

    score,

    created,

    url,

    permalink: url,

    comments: 0,

    subreddit,

    sentiment:
      analysis.label,

    sentimentScore:
      analysis.score,
  };
}

/* =========================================================
   GET SUBREDDIT POSTS
========================================================= */

app.get(
  "/api/subreddit/:subreddit",
  async (req, res) => {

    try {
      let subreddit =
        req.params.subreddit
          .trim()
          .replace(/^r\//i, "");

      /* ---------------------------------------------------
         Validate subreddit
      --------------------------------------------------- */

      if (!subreddit) {
        return res.status(400).json({
          success: false,
          message:
            "Subreddit name is required.",
          posts: [],
        });
      }

      /* ---------------------------------------------------
         Remove invalid characters
      --------------------------------------------------- */

      subreddit =
        subreddit.replace(
          /[^a-zA-Z0-9_]+/g,
          ""
        );

      if (!subreddit) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid subreddit name.",
          posts: [],
        });
      }

      /* ---------------------------------------------------
         Fetch RSS
      --------------------------------------------------- */

      const items =
        await fetchRedditPosts(
          subreddit
        );

      /* ---------------------------------------------------
         No posts
      --------------------------------------------------- */

      if (
        !items ||
        items.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "No posts found for this subreddit.",
          posts: [],
        });
      }

      /* ---------------------------------------------------
         Format posts
      --------------------------------------------------- */

      const posts =
        items
          .map((item, index) =>
            formatRedditPost(
              item,
              index,
              subreddit
            )
          )
          .filter(Boolean);

      console.log(
        `Successfully processed ${posts.length} posts.`
      );

      console.log(
        "======================================"
      );

      /* ---------------------------------------------------
         Return data
      --------------------------------------------------- */

      return res.json({
        success: true,

        subreddit,

        count: posts.length,

        posts,
      });

    } catch (error) {

      console.error("");
      console.error(
        "======================================"
      );
      console.error(
        "ERROR FETCHING SUBREDDIT"
      );
      console.error(
        "======================================"
      );
      console.error(
        error.message
      );

      /* ---------------------------------------------------
         Reddit errors
      --------------------------------------------------- */

      if (error.response) {

        if (
          error.response.status ===
          404
        ) {
          return res.status(404).json({
            success: false,
            message:
              "Subreddit not found.",
            posts: [],
          });
        }

        if (
          error.response.status ===
          429
        ) {
          return res.status(429).json({
            success: false,
            message:
              "Reddit is temporarily rate-limiting requests. Please try again later.",
            posts: [],
          });
        }

        if (
          error.response.status ===
          403
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Reddit denied the request. Please try again later.",
            posts: [],
          });
        }
      }

      /* ---------------------------------------------------
         General error
      --------------------------------------------------- */

      return res.status(500).json({
        success: false,

        message:
          "Unable to fetch posts from Reddit.",

        posts: [],
      });
    }
  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {

    res.status(404).json({
      success: false,

      message:
        "API route not found.",

      posts: [],
    });

  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "Unhandled server error:",
      err
    );

    res.status(500).json({
      success: false,

      message:
        "Internal server error.",

      posts: [],
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log("");

    console.log(
      "======================================"
    );

    console.log(
      "       VibeCheck Backend 🚀"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server running at http://localhost:${PORT}`
    );

    console.log(
      `Health: http://localhost:${PORT}/api/health`
    );

    console.log(
      `API: http://localhost:${PORT}/api/subreddit/programming`
    );

    console.log(
      "======================================"
    );

    console.log("");
  }
);