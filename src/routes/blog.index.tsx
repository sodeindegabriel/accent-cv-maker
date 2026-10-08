import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, User } from "lucide-react";

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
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

export const Route = createFileRoute("/blog/")({
  loader: async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_image_url, author_name, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return { posts: (data ?? []) as BlogPost[] };
  },
  head: () => ({
    meta: [
      { title: "Blog — CVLingo" },
      {
        name: "description",
        content: "Advice, guides and stories for immigrants building their career in the UK.",
      },
      { property: "og:title", content: "Blog — CVLingo" },
      {
        property: "og:description",
        content: "Advice, guides and stories for immigrants building their career in the UK.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.cvlingo.com/blog" },
    ],
  }),
  component: BlogListPage,
});

function BlogListPage() {
  const { posts } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-8 sm:px-6">
        <h1 className="font-serif text-4xl text-foreground sm:text-5xl">Blog</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Advice, guides and stories for immigrants building their career in the UK.
        </p>
      </section>

      {posts.length === 0 ? (
        <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <p className="text-muted-foreground">No posts yet — check back soon.</p>
        </section>
      ) : (
        <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group flex flex-col rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md hover:border-primary/40 overflow-hidden"
              >
                {post.cover_image_url && (
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h2 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{post.excerpt}</p>
                  )}
                  <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                    {post.author_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {post.author_name}
                      </span>
                    )}
                    {post.published_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(post.published_at)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
