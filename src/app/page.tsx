import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";

export default function Home() {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-text-gold mb-4">
          No Rest for the Wicked
        </h1>
        <p className="text-lg text-text-secondary mb-8">
          Build Planner & Item Database
        </p>
        <Link
          href="/planner"
          className="inline-block px-8 py-3 bg-accent-gold/20 border border-accent-gold/60 rounded text-text-gold font-semibold hover:bg-accent-gold/30 transition-colors"
        >
          Open Build Planner
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-text-primary mb-6">
        Item Database
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/db/${cat.slug}`}
            className="group block p-6 bg-bg-card border border-border-subtle rounded-lg hover:border-accent-gold/40 hover:bg-bg-card-hover transition-all text-center"
          >
            <div className="text-3xl mb-3">{cat.icon}</div>
            <div className="text-sm font-semibold text-text-primary group-hover:text-text-gold transition-colors">
              {cat.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
