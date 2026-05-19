interface Props { title: string; subtitle?: string }

export default function PageHeaderBand({ title, subtitle }: Props) {
  return (
    <div className="bg-obsidian-band text-cream py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-display text-4xl font-light tracking-wide">{title}</h1>
        {subtitle && <p className="text-sm text-bone/70 mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}
