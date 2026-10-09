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
  og_image_url: string | null;
  cover_image_alt: string | null;
  seo_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
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
  og_image_url: null,
  cover_image_alt: null,
  seo_title: null,
  meta_description: null,
  focus_keyword: null,
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

// Accepted MIME types
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// Center-crop + scale image on a canvas, return a Blob
function processImageToCanvas(
  imgEl: HTMLImageElement,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  const srcRatio = imgEl.naturalWidth / imgEl.naturalHeight;
  const tgtRatio = targetW / targetH;
  let sx = 0, sy = 0, sw = imgEl.naturalWidth, sh = imgEl.naturalHeight;
  if (srcRatio > tgtRatio) {
    sw = sh * tgtRatio;
    sx = (imgEl.naturalWidth - sw) / 2;
  } else {
    sh = sw / tgtRatio;
    sy = (imgEl.naturalHeight - sh) / 2;
  }
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  canvas.getContext("2d")!.drawImage(imgEl, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Canvas encode failed")),
      type,
      quality,
    );
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

function CoverImageUploader({
  form,
  setForm,
  inputCls,
  labelCls,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  inputCls: string;
  labelCls: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sizeSaving, setSizeSaving] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    setSizeSaving(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Please upload a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setUploadError("Image must be under 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const img = await loadImageElement(file);
      const slug = form.slug || "post";
      const ts = Date.now();

      // WebP for on-page display (1200x630 center-crop)
      const coverCanvas = processImageToCanvas(img, 1200, 630);
      let webpBlob: Blob;
      try {
        webpBlob = await canvasToBlob(coverCanvas, "image/webp", 0.82);
        // Verify browser actually produced WebP
        if (!webpBlob.type.includes("webp")) throw new Error("WebP not supported");
      } catch {
        // Fallback to JPEG if browser cannot encode WebP
        webpBlob = await canvasToBlob(coverCanvas, "image/jpeg", 0.85);
      }

      // JPEG for og:image (1200x630 center-crop — same crop, JPEG format)
      const ogCanvas = processImageToCanvas(img, 1200, 630);
      const jpegBlob = await canvasToBlob(ogCanvas, "image/jpeg", 0.85);

      const webpExt = webpBlob.type.includes("webp") ? "webp" : "jpg";
      const webpFilename = `covers/${slug}-${ts}.${webpExt}`;
      const jpegFilename = `covers/${slug}-${ts}-og.jpg`;

      // Upload both
      const [{ error: webpErr }, { error: jpegErr }] = await Promise.all([
        supabase.storage.from("blog-images").upload(webpFilename, webpBlob, { contentType: webpBlob.type, upsert: true }),
        supabase.storage.from("blog-images").upload(jpegFilename, jpegBlob, { contentType: "image/jpeg", upsert: true }),
      ]);
      if (webpErr) throw new Error(webpErr.message);
      if (jpegErr) throw new Error(jpegErr.message);

      const webpUrl = supabase.storage.from("blog-images").getPublicUrl(webpFilename).data.publicUrl;
      const jpegUrl = supabase.storage.from("blog-images").getPublicUrl(jpegFilename).data.publicUrl;

      const savedPct = Math.round((1 - (webpBlob.size + jpegBlob.size) / (file.size * 2)) * 100);
      setSizeSaving(`${fmtBytes(file.size)} → ${fmtBytes(webpBlob.size)} (WebP) + ${fmtBytes(jpegBlob.size)} (og:JPEG)${savedPct > 0 ? ` — ${savedPct}% smaller` : ""}`);

      setForm((f) => ({ ...f, cover_image_url: webpUrl, og_image_url: jpegUrl }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Cover image</label>
          <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/60 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            {uploading ? "Processing…" : "Upload JPEG / PNG / WebP (max 10 MB)"}
          </label>
          {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
          {sizeSaving && <p className="mt-1 text-xs text-emerald-600">{sizeSaving}</p>}
        </div>
        <div>
          <label className={labelCls}>Cover image alt text</label>
          <input
            className={inputCls}
            value={form.cover_image_alt ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, cover_image_alt: e.target.value }))}
            placeholder="Describe the image for screen readers"
          />
        </div>
      </div>

      {/* Fallback URL field */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={`${labelCls} font-normal normal-case text-[10px]`}>Or paste URL (WebP / display)</label>
          <input
            className={inputCls}
            type="url"
            value={form.cover_image_url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={`${labelCls} font-normal normal-case text-[10px]`}>og:image URL (JPEG, auto-set on upload)</label>
          <input
            className={inputCls}
            type="url"
            value={form.og_image_url ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, og_image_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>
      </div>

      {/* Preview */}
      {form.cover_image_url && (
        <div className="rounded-xl overflow-hidden border border-border bg-muted max-h-40">
          <img src={form.cover_image_url} alt={form.cover_image_alt ?? ""} className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
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
      og_image_url: post.og_image_url,
      cover_image_alt: post.cover_image_alt,
      seo_title: post.seo_title,
      meta_description: post.meta_description,
      focus_keyword: post.focus_keyword,
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
      og_image_url: form.og_image_url?.trim() || null,
      cover_image_alt: form.cover_image_alt?.trim() || null,
      seo_title: form.seo_title?.trim() || null,
      meta_description: form.meta_description?.trim() || null,
      focus_keyword: form.focus_keyword?.trim() || null,
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

          <div className="sm:col-span-2">
            <CoverImageUploader form={form} setForm={setForm} inputCls={inputCls} labelCls={labelCls} />
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

          {/* SEO fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>SEO title (overrides page title)</label>
              <input
                className={inputCls}
                value={form.seo_title ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
                placeholder="Falls back to post title"
              />
            </div>
            <div>
              <label className={labelCls}>Focus keyword (internal only)</label>
              <input
                className={inputCls}
                value={form.focus_keyword ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, focus_keyword: e.target.value }))}
                placeholder="e.g. UK CV format"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Meta description (overrides excerpt)</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.meta_description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))}
              placeholder="Falls back to excerpt. Aim for 150–160 characters."
            />
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
