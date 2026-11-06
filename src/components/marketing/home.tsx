import Image from "next/image";
import Link from "next/link";
import { RevealRoot } from "@/components/marketing/reveal";
import { APP_HOME } from "@/lib/paths";

const CONTACT = "https://taimoorhussain.com/contact";
const SITE = "https://taimoorhussain.com";

const card =
  "rounded-[0.9rem] border border-border bg-card shadow-[0_1px_2px_rgba(20,30,50,0.04),0_8px_24px_-12px_rgba(20,30,50,0.10)]";
const primaryButton =
  "inline-flex items-center justify-center rounded-[0.65rem] bg-primary font-semibold text-white transition-colors hover:bg-[oklch(0.48_0.13_152)]";
const secondaryButton =
  "inline-flex items-center justify-center rounded-[0.65rem] border border-border bg-white font-semibold text-foreground";

const FEATURES = [
  {
    n: "01",
    title: "Clear license statuses",
    body: "Active, expiring, expired, pending, and suspended. Expiring is calculated — active and due within 90 days.",
  },
  {
    n: "02",
    title: "Search and filter",
    body: "Narrow the book by status, state, license type, and pharmacy in a couple of clicks.",
  },
  {
    n: "03",
    title: "Certificates on hand",
    body: "Open any license and download its certificate when a file is on record.",
  },
  {
    n: "04",
    title: "Status control for staff",
    body: "Staff can change a stored status as a license moves through its lifecycle.",
  },
  {
    n: "05",
    title: "Roster import",
    body: "Import an .xlsx roster: map columns, validate, preview, then add only the ready rows.",
  },
  {
    n: "06",
    title: "Accounts, roles, audit",
    body: "Staff with permission issue accounts, edit roles, and read the audit trail.",
  },
] as const;

const ROWS = [
  ["Redwood Coast Pharmacy", "Retail pharmacy", "CA", "in 210 days", "Active", "a"],
  ["Redwood Coast Pharmacy", "Controlled substance", "CA", "in 41 days", "Expiring", "e"],
  ["Example Pharmacy North", "Non\u2011resident", "NV", "\u2014", "Expired", "x"],
  ["Example Pharmacy North", "Retail pharmacy", "OR", "\u2014", "Pending", "p"],
  ["Example Pharmacy South", "Retail pharmacy", "AZ", "\u2014", "Suspended", "s"],
] as const;

export function MarketingHome() {
  return (
    <RevealRoot>
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <BookMark />
            <span className="font-bold">Client License Portal</span>
          </Link>
          <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex" aria-label="Page">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#security" className="hover:text-foreground">
              Security
            </a>
          </nav>
          <Link href={APP_HOME} className={`${primaryButton} px-4 py-2 text-sm`}>
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-16 md:pt-20 lg:grid-cols-2">
        <div className="clp-reveal">
          <p className="mb-4 text-xs font-bold tracking-[0.14em] text-primary uppercase">
            CML Licensing · Client License Portal
          </p>
          <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight md:text-[3.2rem]">
            Every pharmacy license, kept in one calm book.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            An operations desk for staff who keep pharmacy licenses for the clients they already serve — plus a
            read{"\u2011"}only view where each pharmacy sees only its own licenses and notes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={APP_HOME} className={`${primaryButton} px-6 py-3`}>
              Sign in
            </Link>
            <a href={CONTACT} className={`${secondaryButton} px-6 py-3`}>
              Request access
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Accounts are issued by CML. Issued accounts open the app at{" "}
            <span className="font-semibold text-foreground">clp.taimoorhussain.com/app</span>.
          </p>
        </div>

        <div className="clp-reveal relative min-w-0">
          <div className={`${card} overflow-hidden`}>
            <div className="flex h-10 items-center gap-2 border-b border-border bg-[oklch(0.975_0.005_150)] px-4">
              <span className="size-2.5 rounded-full bg-slate-300" />
              <span className="size-2.5 rounded-full bg-slate-300" />
              <span className="size-2.5 rounded-full bg-slate-300" />
              <span className="ml-3 rounded-md border border-border bg-white px-3 py-0.5 text-xs text-muted-foreground">
                clp.taimoorhussain.com/app
              </span>
            </div>
            <Image
              src="/marketing/clp-login.png"
              alt="Client License Portal sign-in screen"
              width={1440}
              height={900}
              priority
              unoptimized
              sizes="(min-width: 1024px) 36rem, 100vw"
              className="block h-auto w-full"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
          <div className={`${card} absolute -bottom-10 -left-6 z-10 hidden w-64 p-4 sm:block`}>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">License book · sample</p>
            <div className="space-y-2 text-sm">
              <SampleRow name="Redwood Coast Pharmacy" kind="a" label="Active" />
              <SampleRow name="Sample Location B" kind="e" label="Expiring" />
              <SampleRow name="Sample Location C" kind="p" label="Pending" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" aria-label="Sample license book">
        <div className={`${card} clp-reveal p-5 md:p-7`}>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-base font-bold">License book</h2>
            <span className={`${secondaryButton} px-3 py-1.5 text-xs`}>Status: All</span>
            <span className={`${secondaryButton} px-3 py-1.5 text-xs`}>State</span>
            <span className={`${secondaryButton} px-3 py-1.5 text-xs`}>Type</span>
            <span className={`${secondaryButton} px-3 py-1.5 text-xs`}>Pharmacy</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-xs tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="py-2 font-medium">Pharmacy</th>
                  <th className="font-medium">Type</th>
                  <th className="font-medium">State</th>
                  <th className="font-medium">Expires</th>
                  <th className="font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ROWS.map((row) => (
                  <tr key={`${row[0]}-${row[1]}-${row[2]}`}>
                    <td className="py-3 font-medium">{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td>{row[3]}</td>
                    <td>
                      <Pill kind={row[5]}>{row[4]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Illustrative sample data. “Expiring” is calculated: active and due within 90 days.
          </p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <p className="clp-reveal text-xs font-bold tracking-[0.14em] text-primary uppercase">Features</p>
        <h2 className="clp-reveal mt-3 max-w-2xl text-3xl font-extrabold tracking-tight md:text-4xl">
          What the desk does — and nothing it doesn&apos;t.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.n} className={`${card} clp-reveal p-6`}>
              <div className="mb-4 grid size-10 place-items-center rounded-lg bg-accent font-bold text-primary">
                {feature.n}
              </div>
              <h3 className="text-lg font-bold">{feature.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-20 bg-accent py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="clp-reveal text-xs font-bold tracking-[0.14em] text-primary uppercase">How it works</p>
          <h2 className="clp-reveal mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            Issued accounts. Two clear views.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <article className={`${card} clp-reveal p-6`}>
              <p className="text-sm font-bold text-primary">Step 1</p>
              <h3 className="mt-1 text-lg font-bold">CML issues your account</h3>
              <p className="mt-2 text-muted-foreground">
                There is no public registration. Staff with permission create every account and assign its role.
              </p>
            </article>
            <article className={`${card} clp-reveal p-6`}>
              <p className="text-sm font-bold text-primary">Step 2</p>
              <h3 className="mt-1 text-lg font-bold">Sign in at /app</h3>
              <p className="mt-2 text-muted-foreground">
                Use the email and password CML gave you. Staff enroll an authenticator app on their first sign
                {"\u2011"}in.
              </p>
            </article>
            <article className={`${card} clp-reveal p-6`}>
              <p className="text-sm font-bold text-primary">Step 3</p>
              <h3 className="mt-1 text-lg font-bold">See what&apos;s yours</h3>
              <p className="mt-2 text-muted-foreground">
                <b>Staff</b> run the full desk. <b>Pharmacy users</b> get a read{"\u2011"}only view of their own
                organizations, locations, licenses, and notes.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="security" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-5 py-20 lg:grid-cols-2">
        <div className="clp-reveal">
          <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">Security</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">Access is deliberate, by design.</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Only people CML has issued an account can sign in, and each role sees only what it should.
          </p>
        </div>
        <ul className="clp-reveal grid gap-4 sm:grid-cols-2">
          <li className={`${card} p-5`}>
            <p className="font-bold">No public registration</p>
            <p className="mt-1 text-sm text-muted-foreground">CML issues every account.</p>
          </li>
          <li className={`${card} p-5`}>
            <p className="font-bold">Issued credentials</p>
            <p className="mt-1 text-sm text-muted-foreground">Email and password sign{"\u2011"}in for issued accounts.</p>
          </li>
          <li className={`${card} p-5`}>
            <p className="font-bold">Staff authenticator</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Staff enroll an authenticator app on first sign{"\u2011"}in.
            </p>
          </li>
          <li className={`${card} p-5`}>
            <p className="font-bold">Role{"\u2011"}based permissions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pharmacies see only their own records; staff actions follow their role.
            </p>
          </li>
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="clp-reveal flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-y border-border py-6 text-sm">
          <span className="text-muted-foreground">Built with</span>
          <span className="font-bold">Next.js</span>
          <span className="font-bold">Node.js</span>
          <span className="font-bold">Supabase</span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div
          className="clp-reveal rounded-[1.2rem] p-10 text-center text-white md:p-14"
          style={{ background: "linear-gradient(135deg, oklch(0.3 0.05 258), oklch(0.36 0.07 200))" }}
        >
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Ready when your account is.</h2>
          <p className="mt-3 opacity-80">Already issued an account? Sign in. Need one? Ask CML.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={APP_HOME} className={`${primaryButton} px-6 py-3`}>
              Sign in
            </Link>
            <a
              href={CONTACT}
              className="inline-flex items-center justify-center rounded-[0.65rem] border border-white/25 bg-white/10 px-6 py-3 font-semibold"
            >
              Request access
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-5 py-8 text-sm text-muted-foreground md:flex-row">
          <div>
            <span className="font-bold text-foreground">Client License Portal</span> · clp.taimoorhussain.com
          </div>
          <div className="flex gap-6">
            <Link href={APP_HOME} className="hover:text-foreground">
              Sign in
            </Link>
            <a href={CONTACT} className="hover:text-foreground">
              Contact
            </a>
            <a href={SITE} className="hover:text-foreground">
              taimoorhussain.com
            </a>
          </div>
        </div>
      </footer>
    </RevealRoot>
  );
}

function BookMark() {
  return (
    <span className="grid size-8 place-items-center rounded-lg bg-primary" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4">
        <path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z" />
        <path d="M8 10h6M8 14h4" />
      </svg>
    </span>
  );
}

function Pill({ kind, children }: { kind: string; children: string }) {
  const tone: Record<string, string> = {
    a: "bg-[oklch(0.94_0.05_152)] text-[oklch(0.42_0.12_152)]",
    e: "bg-[oklch(0.95_0.06_80)] text-[oklch(0.48_0.11_70)]",
    x: "bg-[oklch(0.94_0.04_25)] text-[oklch(0.5_0.14_25)]",
    p: "bg-[oklch(0.94_0.03_250)] text-[oklch(0.45_0.09_255)]",
    s: "bg-[oklch(0.93_0.01_258)] text-[oklch(0.42_0.03_258)]",
  };
  return (
    <span className={`inline-block rounded-full px-[9px] py-[2px] text-[11px] font-semibold ${tone[kind] ?? ""}`}>
      {children}
    </span>
  );
}

function SampleRow({ name, kind, label }: { name: string; kind: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{name}</span>
      <Pill kind={kind}>{label}</Pill>
    </div>
  );
}
