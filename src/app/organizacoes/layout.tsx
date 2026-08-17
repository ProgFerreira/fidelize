import { auth } from "@/lib/auth";

export default async function OrganizacoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-full">
      <header className="flex items-center justify-end gap-3 border-b border-slate-200 px-4 py-3 text-sm">
        {session?.user?.email ? (
          <span className="text-slate-500">{session.user.email}</span>
        ) : null}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sair
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
