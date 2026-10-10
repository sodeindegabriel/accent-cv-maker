import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabaseClient";
import ReactMarkdown from "react-markdown";
import type { ComponentPropsWithoutRef } from "react";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";

const markdownComponents: ComponentPropsWithoutRef<typeof ReactMarkdown>["components"] = {
  a: ({ href, children, ...props }) => {
    if (!href) return <a {...props}>{children}</a>;
    const lower = href.toLowerCase().trim();
    if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
      return <span>{children}</span>;
    }
    const isInternal = href.startsWith("/") || href.startsWith("#") || href.includes("cvlingo.com");
    if (isInternal) {
      return <a href={href} {...props}>{children}</a>;
    }
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
  },
};

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
  author_name: string | null;
  published_at: string | null;
};

type RelatedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  published_at: string | null;
};

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, content, cover_image_url, og_image_url, cover_image_alt, seo_title, meta_description, author_name, published_at")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();

    const { data: relatedPosts } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_image_url, cover_image_alt, published_at")
      .eq("status", "published")
      .neq("slug", params.slug)
      .order("published_at", { ascending: false })
      .limit(3);

    return {
      post: data as BlogPost | null,
      relatedPosts: (relatedPosts ?? []) as RelatedPost[],
    };
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
    const url = `https://www.cvlingo.com/blog/${post.slug}`;
    const description = post.meta_description ?? post.excerpt ?? "Read this article on the CVLingo blog.";
    const seoTitle = post.seo_title ? `${post.seo_title} — CVLingo Blog` : `${post.title} — CVLingo Blog`;
    const ogImage = (() => {
      const raw = post.og_image_url ?? post.cover_image_url ?? "https://www.cvlingo.com/cvlingo-logo.png";
      return raw.startsWith("http") ? raw : `https://www.cvlingo.com${raw}`;
    })();
    return {
      meta: [
        { title: seoTitle },
        { name: "description", content: description },
        { property: "og:title", content: post.seo_title ?? post.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "article:published_time", content: post.published_at ?? "" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.seo_title ?? post.title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImage },
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
            image: ogImage,
            url,
            datePublished: post.published_at,
            author: post.author_name
              ? { "@type": "Person", name: post.author_name }
              : { "@type": "Organization", name: "CVLingo" },
            publisher: {
              "@type": "Organization",
              name: "CVLingo",
              logo: { "@type": "ImageObject", url: "https://www.cvlingo.com/cvlingo-logo.svg" },
            },
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post, relatedPosts } = Route.useLoaderData();

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

  const wordCount = post.content.trim().split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Post header: two-column on desktop, stacked on mobile */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-10 pb-6">
        <Link
          to="/blog"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Blog
        </Link>

        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
          {/* Image: ~42% wide on desktop, full width stacked on mobile */}
          {post.cover_image_url && (
            <div className="w-full sm:w-[42%] flex-shrink-0">
              <img
                src={post.cover_image_url}
                alt={post.cover_image_alt ?? post.title}
                width={1200}
                height={630}
                className="w-full rounded-xl object-cover sm:max-h-[360px] max-h-[240px]"
                style={{ aspectRatio: "1200/630" }}
              />
            </div>
          )}
          {/* Text column */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-3">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="text-muted-foreground text-base mb-4 leading-relaxed">{post.excerpt}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <time dateTime={post.published_at ?? undefined}>
                {new Date(post.published_at ?? new Date().toISOString()).toLocaleDateString("en-GB", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </time>
              {post.author_name && <span>· {post.author_name}</span>}
              <span>· {readingTime} min read</span>
            </div>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-serif prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>

      {/* Keep reading */}
      {relatedPosts.length > 0 && (
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 border-t border-border">
          <h2 className="text-xl font-semibold mb-6">Keep reading</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedPosts.map((rp) => (
              <Link
                key={rp.slug}
                to="/blog/$slug"
                params={{ slug: rp.slug }}
                className="group block rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow"
              >
                {rp.cover_image_url && (
                  <img
                    src={rp.cover_image_url}
                    alt={rp.cover_image_alt ?? rp.title}
                    width={800}
                    height={450}
                    className="w-full object-cover"
                    style={{ aspectRatio: "16/9", maxHeight: "160px" }}
                  />
                )}
                <div className="p-4">
                  <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {rp.title}
                  </p>
                  {rp.excerpt && (
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{rp.excerpt}</p>
                  )}
                  <p className="text-muted-foreground text-xs mt-2">
                    {new Date(rp.published_at ?? new Date().toISOString()).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
