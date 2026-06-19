"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/layout/PageHeader";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  identity_mode: "full" | "name_only" | "company_only" | "anonymous";
  author_name: string | null;
  company_name: string | null;
  likes: number;
  dislikes: number;
  pinned: boolean;
  created_at: string;
  comment_count?: number;
};

type Comment = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  identity_mode: "full" | "name_only" | "company_only" | "anonymous";
  author_name: string | null;
  company_name: string | null;
  likes: number;
  dislikes: number;
  created_at: string;
  replies?: Comment[];
};

type Report = {
  id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  reviewed: boolean;
  created_at: string;
};

const CATEGORIES = [
  { value: "general", label: "💬 General", desc: "General discussion" },
  { value: "clinical", label: "🧠 Clinical", desc: "Clinical tips and strategies" },
  { value: "billing", label: "🏦 Billing", desc: "Insurance and billing help" },
  { value: "hiring", label: "👥 Hiring", desc: "Staff and job opportunities" },
  { value: "bcba_match", label: "🎓 BCBA Match", desc: "Student analysts finding supervisors" },
  { value: "technology", label: "💻 Technology", desc: "Tech tools and integrations" },
  { value: "compliance", label: "🔒 Compliance", desc: "HIPAA and compliance questions" },
];

const IDENTITY_OPTIONS = [
  { value: "full", label: "👤 Full info", desc: "Show name + company" },
  { value: "name_only", label: "🙋 Name only", desc: "Show your name, hide company" },
  { value: "company_only", label: "🏢 Company only", desc: "Show clinic name, hide your name" },
  { value: "anonymous", label: "🕵️ Anonymous", desc: "Hide everything" },
];

const REPORT_REASONS = [
  "Inappropriate content",
  "Spam or advertising",
  "HIPAA violation",
  "Harassment",
  "Misinformation",
  "Other",
];

function getDisplayName(item: Pick<Post, "identity_mode" | "author_name" | "company_name">) {
  switch (item.identity_mode) {
    case "full": return { name: item.author_name ?? "Unknown", company: item.company_name };
    case "name_only": return { name: item.author_name ?? "Unknown", company: null };
    case "company_only": return { name: null, company: item.company_name ?? "A clinic" };
    case "anonymous": return { name: null, company: null };
  }
}

function DisplayLabel({ identity_mode, author_name, company_name }: {
  identity_mode: Post["identity_mode"];
  author_name: string | null;
  company_name: string | null;
}) {
  const { name, company } = getDisplayName({ identity_mode, author_name, company_name });
  if (!name && !company) return <span className="text-gray-400 italic">Anonymous</span>;
  return (
    <span className="text-gray-500 text-xs">
      {name && <span className="font-medium text-gray-700">{name}</span>}
      {name && company && <span className="mx-1">·</span>}
      {company && <span>{company}</span>}
    </span>
  );
}

function IdentityPicker({ value, onChange }: { value: Post["identity_mode"]; onChange: (v: Post["identity_mode"]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {IDENTITY_OPTIONS.map(opt => (
        <button key={opt.value} type="button"
          onClick={() => onChange(opt.value as Post["identity_mode"])}
          title={opt.desc}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${value === opt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [optedOut, setOptedOut] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [filterCategory, setFilterCategory] = useState("all");
  const [userName, setUserName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "reports">("feed");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // New post form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [identityMode, setIdentityMode] = useState<Post["identity_mode"]>("full");
  const [posting, setPosting] = useState(false);

  // Comment / reply
  const [commentText, setCommentText] = useState("");
  const [commentIdentity, setCommentIdentity] = useState<Post["identity_mode"]>("full");
  const [commenting, setCommenting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyIdentity, setReplyIdentity] = useState<Post["identity_mode"]>("full");
  const [replying, setReplying] = useState(false);

  // Report modal
  const [reportTarget, setReportTarget] = useState<{ postId?: string; commentId?: string } | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const [{ data: profile }, { data: companyUser }, { data: optout }] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("company_users").select("company_id, role, companies(name)").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("community_optouts").select("id").eq("user_id", user.id).maybeSingle(),
    ]);

    setUserName(profile?.full_name ?? "");
    setCompanyName((companyUser?.companies as any)?.name ?? "");
    setCompanyId(companyUser?.company_id ?? "");
    setIsAdmin(profile?.role === "admin" || companyUser?.role === "admin");
    setOptedOut(!!optout);
    if (!optout) await loadPosts();
    setLoading(false);
  }

  async function loadPosts() {
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    const postList = data ?? [];
    setPosts(postList);

    // Load comment counts for all posts
    if (postList.length > 0) {
      const ids = postList.map((p: Post) => p.id);
      const { data: countData } = await supabase
        .from("community_comments")
        .select("post_id")
        .in("post_id", ids);
      const counts: Record<string, number> = {};
      (countData ?? []).forEach((r: { post_id: string }) => {
        counts[r.post_id] = (counts[r.post_id] ?? 0) + 1;
      });
      setCommentCounts(counts);
    }
  }

  async function loadComments(postId: string) {
    const { data } = await supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    const all = data ?? [];
    // Build tree: top-level comments with nested replies
    const topLevel = all.filter((c: Comment) => !c.parent_comment_id);
    const withReplies = topLevel.map((c: Comment) => ({
      ...c,
      replies: all.filter((r: Comment) => r.parent_comment_id === c.id),
    }));
    setComments(withReplies);
  }

  async function handleOptOut() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    await supabase.from("community_optouts").insert({ user_id: user.id });
    setOptedOut(true);
    setPosts([]);
  }

  async function handleOptIn() {
    await supabase.from("community_optouts").delete().eq("user_id", userId);
    setOptedOut(false);
    loadPosts();
  }

  async function handlePost() {
    if (!title.trim() || !content.trim()) return;
    setPosting(true);
    await supabase.from("community_posts").insert({
      user_id: userId,
      company_id: companyId || null,
      title: title.trim(),
      content: content.trim(),
      category,
      identity_mode: identityMode,
      author_name: identityMode === "anonymous" || identityMode === "company_only" ? null : userName,
      company_name: identityMode === "anonymous" || identityMode === "name_only" ? null : companyName,
      likes: 0,
      dislikes: 0,
      pinned: false,
    });
    setTitle(""); setContent(""); setIdentityMode("full"); setShowNewPost(false);
    await loadPosts();
    setPosting(false);
  }

  async function handlePostReaction(postId: string, type: "likes" | "dislikes") {
    const post = posts.find((p: Post) => p.id === postId);
    if (!post) return;
    const newVal = (post[type] ?? 0) + 1;
    await supabase.from("community_posts").update({ [type]: newVal }).eq("id", postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, [type]: newVal } : p));
    if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, [type]: newVal } : prev);
  }

  async function handlePin(postId: string, pinned: boolean) {
    await supabase.from("community_posts").update({ pinned: !pinned }).eq("id", postId);
    await loadPosts();
    if (selectedPost?.id === postId) setSelectedPost(prev => prev ? { ...prev, pinned: !pinned } : prev);
  }

  async function openPost(post: Post) {
    setSelectedPost(post);
    setReplyingTo(null);
    setCommentText("");
    await loadComments(post.id);
  }

  async function handleComment() {
    if (!commentText.trim() || !selectedPost) return;
    setCommenting(true);
    await supabase.from("community_comments").insert({
      post_id: selectedPost.id,
      user_id: userId,
      company_id: companyId || null,
      parent_comment_id: null,
      content: commentText.trim(),
      identity_mode: commentIdentity,
      author_name: commentIdentity === "anonymous" || commentIdentity === "company_only" ? null : userName,
      company_name: commentIdentity === "anonymous" || commentIdentity === "name_only" ? null : companyName,
      likes: 0,
      dislikes: 0,
    });
    setCommentText("");
    setCommentCounts(prev => ({ ...prev, [selectedPost.id]: (prev[selectedPost.id] ?? 0) + 1 }));
    await loadComments(selectedPost.id);
    setCommenting(false);
  }

  async function handleReply() {
    if (!replyText.trim() || !selectedPost || !replyingTo) return;
    setReplying(true);
    await supabase.from("community_comments").insert({
      post_id: selectedPost.id,
      user_id: userId,
      company_id: companyId || null,
      parent_comment_id: replyingTo.id,
      content: replyText.trim(),
      identity_mode: replyIdentity,
      author_name: replyIdentity === "anonymous" || replyIdentity === "company_only" ? null : userName,
      company_name: replyIdentity === "anonymous" || replyIdentity === "name_only" ? null : companyName,
      likes: 0,
      dislikes: 0,
    });
    setReplyText(""); setReplyingTo(null);
    setCommentCounts(prev => ({ ...prev, [selectedPost.id]: (prev[selectedPost.id] ?? 0) + 1 }));
    await loadComments(selectedPost.id);
    setReplying(false);
  }

  async function handleCommentReaction(commentId: string, type: "likes" | "dislikes") {
    const flat = comments.flatMap((c: Comment) => [c, ...(c.replies ?? [])]);
    const comment = flat.find(c => c.id === commentId);
    if (!comment) return;
    const newVal = (comment[type] ?? 0) + 1;
    await supabase.from("community_comments").update({ [type]: newVal }).eq("id", commentId);
    setComments(prev => prev.map((c: Comment) => {
      if (c.id === commentId) return { ...c, [type]: newVal };
      return { ...c, replies: (c.replies ?? []).map((r: Comment) => r.id === commentId ? { ...r, [type]: newVal } : r) };
    }));
  }

  async function handleReport() {
    if (!reportTarget) return;
    setSubmittingReport(true);
    await supabase.from("community_reports").insert({
      post_id: reportTarget.postId ?? null,
      comment_id: reportTarget.commentId ?? null,
      reported_by: userId,
      reason: reportReason,
    });
    setReportTarget(null);
    setSubmittingReport(false);
    alert("Report submitted. Our team will review it.");
  }

  async function loadReports() {
    setReportsLoading(true);
    const { data } = await supabase
      .from("community_reports")
      .select("*")
      .order("created_at", { ascending: false });
    setReports(data ?? []);
    setReportsLoading(false);
  }

  async function markReviewed(id: string) {
    await supabase.from("community_reports").update({ reviewed: true }).eq("id", id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, reviewed: true } : r));
  }

  const filteredPosts = filterCategory === "all" ? posts : posts.filter(p => p.category === filterCategory);

  if (loading) return <div className="p-8 text-gray-400">Loading community...</div>;

  if (optedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Community" />
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <div className="text-4xl mb-4">🔇</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">You have opted out of the community</h2>
          <p className="text-gray-500 text-sm mb-6">Rejoin at any time to connect with other ABA clinics.</p>
          <Button onClick={handleOptIn}>Rejoin Community</Button>
        </div>
      </div>
    );
  }

  // REPORT MODAL
  const ReportModal = () => (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="font-bold text-gray-900 mb-1">🚩 Report Content</h3>
        <p className="text-xs text-gray-500 mb-4">Select a reason and we will review this post.</p>
        <div className="space-y-2 mb-4">
          {REPORT_REASONS.map(r => (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="reason" value={r}
                checked={reportReason === r}
                onChange={() => setReportReason(r)}
                className="accent-blue-600" />
              {r}
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setReportTarget(null)}
            className="text-sm px-4 py-2 border rounded-lg text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleReport} disabled={submittingReport}
            className="text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {submittingReport ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );

  // THREAD VIEW
  if (selectedPost) {
    const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

    return (
      <div className="space-y-6">
        {reportTarget && <ReportModal />}
        <PageHeader title="Community">
          <Button variant="outline" onClick={() => { setSelectedPost(null); setReplyingTo(null); }}>← Back to Feed</Button>
        </PageHeader>

        {/* POST */}
        <div className="border border-gray-100 rounded-2xl p-6 bg-white">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                {CATEGORIES.find(c => c.value === selectedPost.category)?.label ?? selectedPost.category}
              </span>
              {selectedPost.pinned && <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full">📌 Pinned</span>}
            </div>
            <span className="text-xs text-gray-400">{new Date(selectedPost.created_at).toLocaleDateString()}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{selectedPost.title}</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{selectedPost.content}</p>
          <div className="flex items-center gap-2 text-xs border-t pt-3 flex-wrap">
            <DisplayLabel identity_mode={selectedPost.identity_mode} author_name={selectedPost.author_name} company_name={selectedPost.company_name} />
            <div className="ml-auto flex items-center gap-2">
              {isAdmin && (
                <button onClick={() => handlePin(selectedPost.id, selectedPost.pinned)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-yellow-200 text-yellow-600 hover:bg-yellow-50 transition-colors text-xs">
                  {selectedPost.pinned ? "📌 Unpin" : "📌 Pin"}
                </button>
              )}
              <button onClick={() => handlePostReaction(selectedPost.id, "likes")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors">
                👍 {selectedPost.likes ?? 0}
              </button>
              <button onClick={() => handlePostReaction(selectedPost.id, "dislikes")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                👎 {selectedPost.dislikes ?? 0}
              </button>
              <button onClick={() => setReportTarget({ postId: selectedPost.id })}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                🚩
              </button>
            </div>
          </div>
        </div>

        {/* COMMENTS THREAD */}
        <Section title={`💬 ${totalComments} Comment${totalComments !== 1 ? "s" : ""}`}>
          <div className="space-y-4 mb-6">
            {comments.length === 0 && (
              <p className="text-gray-400 text-sm">No comments yet. Be the first!</p>
            )}

            {comments.map(comment => (
              <div key={comment.id}>
                {/* TOP LEVEL COMMENT */}
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">{comment.content}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DisplayLabel identity_mode={comment.identity_mode} author_name={comment.author_name} company_name={comment.company_name} />
                    <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => handleCommentReaction(comment.id, "likes")}
                        className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-green-100 text-green-600 hover:bg-green-50 transition-colors">
                        👍 {comment.likes ?? 0}
                      </button>
                      <button onClick={() => handleCommentReaction(comment.id, "dislikes")}
                        className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-red-100 text-red-400 hover:bg-red-50 transition-colors">
                        👎 {comment.dislikes ?? 0}
                      </button>
                      <button
                        onClick={() => { setReplyingTo(replyingTo?.id === comment.id ? null : comment); setReplyText(""); }}
                        className="text-xs px-1.5 py-0.5 rounded border border-blue-100 text-blue-500 hover:bg-blue-50 transition-colors">
                        ↩ Reply {(comment.replies?.length ?? 0) > 0 && `· ${comment.replies!.length}`}
                      </button>
                      <button onClick={() => setReportTarget({ commentId: comment.id })}
                        className="text-xs px-1.5 py-0.5 rounded border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                        🚩
                      </button>
                    </div>
                  </div>
                </div>

                {/* INLINE REPLY BOX */}
                {replyingTo?.id === comment.id && (
                  <div className="ml-6 mt-2 bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-blue-600 font-medium">
                      ↩ Replying to {comment.author_name ?? "Anonymous"}
                    </p>
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                      placeholder="Write your reply..."
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <IdentityPicker value={replyIdentity} onChange={setReplyIdentity} />
                      <div className="flex gap-2">
                        <button onClick={() => setReplyingTo(null)}
                          className="text-xs px-3 py-1.5 border rounded-lg text-gray-500 hover:bg-gray-100">
                          Cancel
                        </button>
                        <button onClick={handleReply} disabled={replying || !replyText.trim()}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {replying ? "Posting..." : "Post Reply"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* NESTED REPLIES */}
                {(comment.replies ?? []).length > 0 && (
                  <div className="ml-6 mt-2 space-y-2 border-l-2 border-blue-100 pl-3">
                    {(comment.replies ?? []).map(reply => (
                      <div key={reply.id} className="bg-white border border-gray-100 rounded-xl p-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">{reply.content}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <DisplayLabel identity_mode={reply.identity_mode} author_name={reply.author_name} company_name={reply.company_name} />
                          <span className="text-xs text-gray-400">{new Date(reply.created_at).toLocaleDateString()}</span>
                          <div className="ml-auto flex items-center gap-1.5">
                            <button onClick={() => handleCommentReaction(reply.id, "likes")}
                              className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-green-100 text-green-600 hover:bg-green-50 transition-colors">
                              👍 {reply.likes ?? 0}
                            </button>
                            <button onClick={() => handleCommentReaction(reply.id, "dislikes")}
                              className="text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-red-100 text-red-400 hover:bg-red-50 transition-colors">
                              👎 {reply.dislikes ?? 0}
                            </button>
                            <button onClick={() => setReportTarget({ commentId: reply.id })}
                              className="text-xs px-1.5 py-0.5 rounded border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                              🚩
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* NEW TOP-LEVEL COMMENT */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Add a comment</p>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <IdentityPicker value={commentIdentity} onChange={setCommentIdentity} />
              <Button onClick={handleComment} loading={commenting} disabled={!commentText.trim()}>
                Post Comment
              </Button>
            </div>
          </div>
        </Section>
      </div>
    );
  }

  // FEED VIEW
  return (
    <div className="space-y-6">
      {reportTarget && <ReportModal />}

      <PageHeader title="Community">
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <div className="flex border rounded-lg overflow-hidden text-xs">
              <button onClick={() => setActiveTab("feed")}
                className={`px-3 py-1.5 transition-colors ${activeTab === "feed" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                Feed
              </button>
              <button onClick={() => { setActiveTab("reports"); loadReports(); }}
                className={`px-3 py-1.5 transition-colors ${activeTab === "reports" ? "bg-red-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                🚩 Reports
              </button>
            </div>
          )}
          <Button onClick={() => setShowNewPost(s => !s)}>
            {showNewPost ? "✕ Cancel" : "+ New Post"}
          </Button>
          <button onClick={handleOptOut}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2">
            Opt Out
          </button>
        </div>
      </PageHeader>

      {/* ADMIN REPORTS TAB */}
      {isAdmin && activeTab === "reports" && (
        <Section title="Flagged Content">
          {reportsLoading && <p className="text-gray-400 text-sm">Loading reports...</p>}
          {!reportsLoading && reports.length === 0 && <p className="text-gray-400 text-sm">No reports yet.</p>}
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className={`border rounded-xl p-4 ${r.reviewed ? "border-gray-100 opacity-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.reason}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.post_id && `Post: ${r.post_id.slice(0, 8)}...`}
                      {r.comment_id && `Comment: ${r.comment_id.slice(0, 8)}...`}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  {!r.reviewed && (
                    <button onClick={() => markReviewed(r.id)}
                      className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      Mark Reviewed
                    </button>
                  )}
                  {r.reviewed && <span className="text-xs text-green-600 font-medium">✓ Reviewed</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {activeTab === "feed" && (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            🌐 Connect with other ABA clinics, share clinical tips, and find BCBA supervisors. Choose how much of your identity to share on each post.
          </div>

          {showNewPost && (
            <Section title="New Post">
              <div className="space-y-3">
                <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Post title"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>)}
                </select>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Share your thoughts, questions, or resources..."
                  rows={5}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Who sees your identity?</p>
                  <IdentityPicker value={identityMode} onChange={setIdentityMode} />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Posting as: {identityMode === "full" ? `${userName} · ${companyName}` : identityMode === "name_only" ? userName : identityMode === "company_only" ? companyName : "Anonymous"}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handlePost} loading={posting} disabled={!title.trim() || !content.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            </Section>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setFilterCategory("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filterCategory === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All Posts
            </button>
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => setFilterCategory(c.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filterCategory === c.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredPosts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-sm">No posts yet. Be the first to start a conversation!</p>
              </div>
            )}
            {filteredPosts.map(post => (
              <div key={post.id}
                onClick={() => openPost(post)}
                className={`border rounded-2xl p-5 bg-white hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer ${post.pinned ? "border-yellow-200 bg-yellow-50/30" : "border-gray-100"}`}>
                <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {CATEGORIES.find(c => c.value === post.category)?.label ?? post.category}
                    </span>
                    {post.pinned && <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full">📌 Pinned</span>}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{post.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{post.content}</p>
                <div className="flex items-center gap-3 mt-3 text-xs">
                  <DisplayLabel identity_mode={post.identity_mode} author_name={post.author_name} company_name={post.company_name} />
                  <div className="ml-auto flex items-center gap-3 text-gray-400">
                    <span className="flex items-center gap-1">
                      💬 {commentCounts[post.id] ?? 0} {(commentCounts[post.id] ?? 0) === 1 ? "comment" : "comments"}
                    </span>
                    <span>👍 {post.likes ?? 0}</span>
                    <span>👎 {post.dislikes ?? 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


