import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { APP_HOME } from "@/lib/paths";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70svh] max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">Missing page</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">That page is not here</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The public site is the homepage. Issued accounts open the license book in the app.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className={buttonVariants()}>
          Back to the site
        </Link>
        <Link href={APP_HOME} className={buttonVariants({ variant: "outline" })}>
          Open the app
        </Link>
      </div>
    </main>
  );
}
