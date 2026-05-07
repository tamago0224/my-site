type PostModule = {
  frontmatter: {
    title: string;
    pubDate: string;
    description?: string;
    image?: {
      url: string;
      alt: string;
    };
    tags?: string[];
    author?: string;
  };
  url: string;
};

export type BlogPost = PostModule;

export function getAllPosts() {
  const postModules = import.meta.glob<PostModule>("../pages/posts/*.md", {
    eager: true,
  });
  const posts = Object.values(postModules);

  return posts.sort(
    (a, b) =>
      new Date(b.frontmatter.pubDate).valueOf() -
      new Date(a.frontmatter.pubDate).valueOf(),
  );
}

export function getPostTags(posts: BlogPost[]) {
  return [
    ...new Set(posts.flatMap((post) => post.frontmatter.tags ?? [])),
  ].sort();
}

export function getPostsByTag(posts: BlogPost[], tag: string) {
  return posts.filter((post) => post.frontmatter.tags?.includes(tag));
}
