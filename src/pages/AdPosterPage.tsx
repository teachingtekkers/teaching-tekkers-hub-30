import { Megaphone } from "lucide-react";

export default function AdPosterPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Advertisement Poster Creation</h1>
          <p className="text-sm text-muted-foreground mt-1">Design and generate camp advertisement posters</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-4">
          <Megaphone className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Coming Soon</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Poster creation tools will be available here.</p>
      </div>
    </div>
  );
}
