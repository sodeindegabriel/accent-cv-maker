import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabaseClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Calendar, User } from "lucide-react";

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  author_name: string | null;
  published_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, content, cover_image_url, author_name, published_at")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();

    return { post: data as BlogPost | null };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return {
        meta: [
          { title: "Post Not Found — CVLingo Blog" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = `https://cvlingo.com/blog/${post.slug}`;
    const description = post.excerpt ?? "Read this article on the CVLingo blog.";
    const image = post.cover_image_url ?? "https://cvlingo.com/cvlingo-logo.png";
    return {
      meta: [
        { title: `${post.title} — CVLingo Blog` },
        { name: "description", content: description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "article:published_time", content: post.published_at ?? "" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description,
            image,
            url,
            datePublished: post.published_at,
            author: post.author_name
              ? { "@type": "Person", name: post.author_name }
              : { "@type": "Organization", name: "CVLingo" },
            publisher: {
              "@type": "Organization",
              name: "CVLingo",
              logo: { "@type": "ImageObject", url: "https://cvlingo.com/cvlingo-logo.svg" },
            },
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();

  if (!post) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="font-serif text-4xl text-foreground">Post not found</h1>
        <p className="mt-3 text-muted-foreground">
          This article doesn't exist or hasn't been published yet.
        </p>
        <Link
          to="/blog"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Blog
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {post.cover_image_url && (
        <div className="aspect-[21/9] w-full overflow-hidden bg-muted">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Link
          to="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Blog
        </Link>

        <header className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl leading-tight">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-3 text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t border-border pt-4">
            {post.author_name && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {post.author_name}
              </span>
            )}
            {post.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {fmtDate(post.published_at)}
              </span>
            )}
          </div>
        </header>

        <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-serif prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
