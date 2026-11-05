import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="max-w-lg">
      <p className="text-[0.7rem] font-medium tracking-[0.18em] text-primary uppercase">Missing page</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">That page is not in the portal</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The license book, organizations, and roster import are available from the sidebar.
      </p>
      <Link href="/" className={`${buttonVariants()} mt-5`}>
        Back to overview
      </Link>
    </div>
  );
}
