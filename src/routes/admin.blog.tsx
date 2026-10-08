import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  author_name: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
};

type FormState = Omit<BlogPost, "id" | "created_at"> & { id?: string };

const emptyForm = (): FormState => ({
  slug: "",
  title: "",
  excerpt: null,
  content: "",
  cover_image_url: null,
  author_name: null,
  status: "draft",
  published_at: null,
});

function slugify(t: string) {
  return t.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AdminBlogPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [slugTaken, setSlugTaken] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }
    supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p?.role === "admin" || p?.role === "super_admin") {
          setIsAdmin(true);
          const name = (p as { full_name?: string | null; email?: string | null }).full_name
            ?? user.email
            ?? "";
          setForm((f) => ({ ...f, author_name: name }));
        } else {
          navigate({ to: "/dashboard" });
        }
      });
  }, [authLoading, user, navigate]);

  const loadPosts = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { setLoadError(error.message); return; }
    setPosts((data ?? []) as BlogPost[]);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void loadPosts();
  }, [isAdmin, loadPosts]);

  function openNew() {
    setForm({ ...emptyForm(), author_name: form.author_name });
    setEditing(true);
    setSaveError(null);
    setSlugTaken(false);
    setPreview(false);
  }

  function openEdit(post: BlogPost) {
    setForm({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image_url,
      author_name: post.author_name,
      status: post.status,
      published_at: post.published_at,
    });
    setEditing(true);
    setSaveError(null);
    setSlugTaken(false);
    setPreview(false);
  }

  function closeForm() {
    setEditing(false);
    setForm(emptyForm());
    setSaveError(null);
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug: f.id ? f.slug : slugify(title),
    }));
    setSlugTaken(false);
  }

  async function handleSave(publish: boolean) {
    setSaveError(null);
    setSaving(true);
    setSlugTaken(false);

    const now = new Date().toISOString();
    const payload: Partial<BlogPost> = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      excerpt: form.excerpt?.trim() || null,
      content: form.content,
      cover_image_url: form.cover_image_url?.trim() || null,
      author_name: form.author_name?.trim() || null,
      status: publish ? "published" : form.status,
      published_at: publish && !form.published_at ? now : form.published_at,
    };

    if (!payload.title) { setSaveError("Title is required."); setSaving(false); return; }
    if (!payload.slug) { setSaveError("Slug is required."); setSaving(false); return; }

    if (form.id) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", form.id);
      if (error) {
        if (error.code === "23505") setSlugTaken(true);
        else setSaveError(error.message);
        setSaving(false);
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === form.id ? { ...p, ...payload } as BlogPost : p)));
    } else {
      const { data, error } = await supabase.from("blog_posts").insert(payload).select().maybeSingle();
      if (error) {
        if (error.code === "23505") setSlugTaken(true);
        else setSaveError(error.message);
        setSaving(false);
        return;
      }
      if (data) setPosts((prev) => [data as BlogPost, ...prev]);
    }

    setSaving(false);
    closeForm();
  }

  async function togglePublish(post: BlogPost) {
    const newStatus = post.status === "published" ? "draft" : "published";
    const updates: Partial<BlogPost> = {
      status: newStatus,
      ...(newStatus === "published" && !post.published_at
        ? { published_at: new Date().toISOString() }
        : {}),
    };
    const { error } = await supabase.from("blog_posts").update(updates).eq("id", post.id);
    if (!error) setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...updates } as BlogPost : p)));
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
      if (form.id === id) closeForm();
    }
  }

  if (!isAdmin) return null;

  const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Blog Posts</h1>
          <p className="text-sm text-muted-foreground">{posts.length} total</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Post
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Post list */}
      {posts.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium max-w-xs truncate">{post.title}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      post.status === "published"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {fmtDate(post.published_at ?? post.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title={post.status === "published" ? "Unpublish" : "Publish"}
                        onClick={() => void togglePublish(post)}
                        className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                      >
                        {post.status === "published"
                          ? <EyeOff className="h-3.5 w-3.5" />
                          : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(post)}
                        className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirmId === post.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDelete(post.id)}
                            className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(post.id)}
                          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {posts.length === 0 && !loadError && (
        <p className="text-sm text-muted-foreground">No posts yet. Click "New Post" to create one.</p>
      )}

      {/* Create / Edit form */}
      {editing && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">{form.id ? "Edit Post" : "New Post"}</h2>
            <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {saveError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Title *</label>
              <input
                className={inputCls}
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. How to write a UK CV"
              />
            </div>
            <div>
              <label className={labelCls}>
                Slug *
                {slugTaken && (
                  <span className="ml-2 text-red-600 normal-case">— already taken</span>
                )}
              </label>
              <input
                className={`${inputCls} ${slugTaken ? "border-red-400" : ""}`}
                value={form.slug}
                onChange={(e) => { setForm((f) => ({ ...f, slug: e.target.value })); setSlugTaken(false); }}
                placeholder="auto-generated from title"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Excerpt (shown in listings and meta description)</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.excerpt ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              placeholder="1-2 sentence summary"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Cover image URL</label>
              <input
                className={inputCls}
                type="url"
                value={form.cover_image_url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className={labelCls}>Author name</label>
              <input
                className={inputCls}
                value={form.author_name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
                placeholder="Ezinwa / Gee"
              />
            </div>
          </div>

          {/* Markdown editor + preview */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelCls}>Content (Markdown) *</label>
              <button
                type="button"
                onClick={() => setPreview((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {preview ? "Hide preview" : "Show preview"}
              </button>
            </div>

            {preview ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <textarea
                  className={`${inputCls} resize-y font-mono text-xs`}
                  rows={20}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Write your post in Markdown..."
                />
                <div className="overflow-auto rounded-xl border border-border bg-background p-4 prose prose-neutral max-w-none prose-sm dark:prose-invert prose-headings:font-serif prose-a:text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {form.content || "*Nothing to preview yet.*"}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <textarea
                className={`${inputCls} resize-y font-mono text-xs`}
                rows={20}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Write your post in Markdown..."
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(false)}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(true)}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Publishing…" : form.status === "published" ? "Save & keep published" : "Publish"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/admin/blog")({
  codeSplitGroupings: [],
  component: AdminBlogPage,
});
