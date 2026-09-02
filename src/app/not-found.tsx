import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center sm:px-6">
      <p className="font-heading sw-glow-pink text-sw-pink text-7xl font-bold tracking-tight">
        404
      </p>
      <h1 className="mt-6 text-2xl font-bold">Nothing filed under that name</h1>
      <p className="text-sw-text-dim mt-3 leading-relaxed">
        The archive holds 500 artists. Whoever you were looking for is not one
        of them &mdash; or the link has a typo in it.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/artists">Search the archive</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
