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
};

type Comment = {
  id: string;
  post_id: string;
  content: string;
  identity_mode: "full" | "name_only" | "company_only" | "anonymous";
  author_name: string | null;
  company_name: string | null;
  likes: number;
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

function getDisplayName(post: Pick<Post, "identity_mode" | "author_name" | "company_name">) {
  switch (post.identity_mode) {
    case "full": return { name: post.author_name ?? "Unknown", company: post.company_name };
    case "name_only": return { name: post.author_name ?? "Unknown", company: null };
    case "company_only": return { name: null, company: post.company_name ?? "A clinic" };
    case "anonymous": return { name: null, company: null };
  }
}

function DisplayLabel({ identity_mode, author_name, company_name }: { identity_mode: Post["identity_mode"]; author_name: string | null; company_name: string | null }) {
  const { name, company } = getDisplayName({ identity_mode, author_name, company_name });
  if (!name && !company) return <span className="text-gray-400 italic">Anonymous</span>;
  return (
    <span className="text-gray-500">
      {name && <span>{name}</span>}
      {name && company && <span className="mx-1">·</span>}
      {company && <span>{company}</span>}
    </span>
  );
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
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

  // New post form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [identityMode, setIdentityMode] = useState<Post["identity_mode"]>("full");
  const [posting, setPosting] = useState(false);

  // New comment
  const [commentText, setCommentText] = useState("");
  const [commentIdentity, setCommentIdentity] = useState<Post["identity_mode"]>("full");
  const [commenting, setCommenting] = useState(false);

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

    if (!optout) loadPosts();
    setLoading(false);
  }

  async function loadPosts() {
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts(data ?? []);
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

  async function handleLike(postId: string, type: "likes" | "dislikes") {
    const post = posts.find(p => p.id === postId);
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
    const { data } = await supabase.from("community_comments").select("*").eq("post_id", post.id).order("created_at");
    setComments(data ?? []);
  }

  async function handleComment() {
    if (!commentText.trim() || !selectedPost) return;
    setCommenting(true);
    await supabase.from("community_comments").insert({
      post_id: selectedPost.id,
      user_id: userId,
      company_id: companyId || null,
      content: commentText.trim(),
      identity_mode: commentIdentity,
      author_name: commentIdentity === "anonymous" || commentIdentity === "company_only" ? null : userName,
      company_name: commentIdentity === "anonymous" || commentIdentity === "name_only" ? null : companyName,
      likes: 0,
    });
    setCommentText(""); setCommentIdentity("full");
    const { data } = await supabase.from("community_comments").select("*").eq("post_id", selectedPost.id).order("created_at");
    setComments(data ?? []);
    setCommenting(false);
  }

  async function handleCommentLike(commentId: string) {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    const newVal = (comment.likes ?? 0) + 1;
    await supabase.from("community_comments").update({ likes: newVal }).eq("id", commentId);
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes: newVal } : c));
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
          <p className="text-gray-500 text-sm mb-6">You can rejoin at any time to connect with other ABA clinics and student analysts.</p>
          <Button onClick={handleOptIn}>Rejoin Community</Button>
        </div>
      </div>
    );
  }

  if (selectedPost) {
    return (
      <div className="space-y-6">
        <PageHeader title="Community">
          <Button variant="outline" onClick={() => setSelectedPost(null)}>← Back to Feed</Button>
        </PageHeader>

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
          <div className="flex items-center gap-3 text-xs border-t pt-3 flex-wrap">
            <DisplayLabel identity_mode={selectedPost.identity_mode} author_name={selectedPost.author_name} company_name={selectedPost.company_name} />
            <div className="ml-auto flex items-center gap-2">
              {isAdmin && (
                <button onClick={() => handlePin(selectedPost.id, selectedPost.pinned)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-yellow-200 text-yellow-600 hover:bg-yellow-50 transition-colors">
                  {selectedPost.pinned ? "📌 Unpin" : "📌 Pin"}
                </button>
              )}
              <button onClick={() => handleLike(selectedPost.id, "likes")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors">
                👍 {selectedPost.likes ?? 0}
              </button>
              <button onClick={() => handleLike(selectedPost.id, "dislikes")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                👎 {selectedPost.dislikes ?? 0}
              </button>
            </div>
          </div>
        </div>

        <Section title={`Comments (${comments.length})`}>
          <div className="space-y-3 mb-4">
            {comments.length === 0 && <p className="text-gray-400 text-sm">No comments yet. Be the first!</p>}
            {comments.map(c => (
              <div key={c.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                  <DisplayLabel identity_mode={c.identity_mode} author_name={c.author_name} company_name={c.company_name} />
                  <span className="ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
                  <button onClick={() => handleCommentLike(c.id)}
                    className="flex items-center gap-1 hover:text-green-600 transition-colors">
                    👍 {c.likes ?? 0}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex flex-wrap gap-1">
                {IDENTITY_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setCommentIdentity(opt.value as Post["identity_mode"])}
                    title={opt.desc}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${commentIdentity === opt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button onClick={handleComment} loading={commenting} disabled={!commentText.trim()}>
                Post Comment
              </Button>
            </div>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Community">
        <div className="flex gap-2">
          <Button onClick={() => setShowNewPost(s => !s)}>
            {showNewPost ? "✕ Cancel" : "+ New Post"}
          </Button>
          <button onClick={handleOptOut}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2">
            Opt Out
          </button>
        </div>
      </PageHeader>

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
              <div className="flex flex-wrap gap-2">
                {IDENTITY_OPTIONS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setIdentityMode(opt.value as Post["identity_mode"])}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${identityMode === opt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"}`}>
                    {opt.label}
                    <span className="ml-1 opacity-70">— {opt.desc}</span>
                  </button>
                ))}
              </div>
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
              <div className="ml-auto flex items-center gap-2 text-gray-400">
                <span>👍 {post.likes ?? 0}</span>
                <span>👎 {post.dislikes ?? 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
