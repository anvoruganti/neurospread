export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p>© {new Date().getFullYear()} NeuroSpread · Research & education only</p>
        <p>
          Data:{" "}
          <a
            className="text-teal-300/90 hover:underline"
            href="https://physionet.org/content/chbmit/1.0.0/"
            rel="noopener noreferrer"
            target="_blank"
          >
            CHB-MIT Scalp EEG (PhysioNet)
          </a>
        </p>
      </div>
    </footer>
  );
}
