"use client";

import { FormEvent, useMemo, useState } from "react";

type SectionKey = "homeTasks" | "generalShopping" | "supermarketShopping";

type Item = {
  id: number;
  text: string;
  completed: boolean;
};

type Section = {
  title: string;
  placeholder: string;
  items: Item[];
};

const initialSections: Record<SectionKey, Section> = {
  homeTasks: {
    title: "משימות בית",
    placeholder: "הוספת משימה חדשה",
    items: [
      { id: 1, text: "לקפל כביסה", completed: false },
      { id: 2, text: "לשטוף כלים", completed: true },
      { id: 3, text: "להוציא אשפה", completed: false },
    ],
  },
  generalShopping: {
    title: "רשימת קניות כללית",
    placeholder: "הוספת פריט לרשימה",
    items: [
      { id: 1, text: "סבון ידיים", completed: false },
      { id: 2, text: "נייר אפייה", completed: false },
      { id: 3, text: "שקיות זבל", completed: true },
    ],
  },
  supermarketShopping: {
    title: "רשימת קניות לסופר",
    placeholder: "הוספת מוצר לסופר",
    items: [
      { id: 1, text: "חלב", completed: false },
      { id: 2, text: "לחם", completed: true },
      { id: 3, text: "ביצים", completed: false },
    ],
  },
};

export default function HomePage() {
  const [sections, setSections] = useState(initialSections);
  const [inputs, setInputs] = useState<Record<SectionKey, string>>({
    homeTasks: "",
    generalShopping: "",
    supermarketShopping: "",
  });

  const keys = useMemo(
    () => Object.keys(sections) as SectionKey[],
    [sections],
  );

  const handleAddItem = (key: SectionKey) => {
    const text = inputs[key].trim();
    if (!text) return;

    setSections((prev) => {
      const nextId =
        prev[key].items.length > 0
          ? Math.max(...prev[key].items.map((item) => item.id)) + 1
          : 1;

      return {
        ...prev,
        [key]: {
          ...prev[key],
          items: [{ id: nextId, text, completed: false }, ...prev[key].items],
        },
      };
    });

    setInputs((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSubmit = (event: FormEvent, key: SectionKey) => {
    event.preventDefault();
    handleAddItem(key);
  };

  const toggleComplete = (key: SectionKey, id: number) => {
    setSections((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        items: prev[key].items.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item,
        ),
      },
    }));
  };

  const deleteItem = (key: SectionKey, id: number) => {
    setSections((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        items: prev[key].items.filter((item) => item.id !== id),
      },
    }));
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:mb-8 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ניהול הבית</h1>
        <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
          רשימות מסודרות לניהול משימות וקניות במקום אחד
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {keys.map((key) => {
          const section = sections[key];
          return (
            <article
              key={key}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                  {section.items.length} פריטים
                </span>
              </div>

              <form
                className="mb-4 flex flex-col gap-2"
                onSubmit={(event) => handleSubmit(event, key)}
              >
                <input
                  value={inputs[key]}
                  onChange={(event) =>
                    setInputs((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  placeholder={section.placeholder}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  הוספה
                </button>
              </form>

              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => toggleComplete(key, item.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-right"
                    >
                      <span
                        className={`h-4 w-4 shrink-0 rounded-full border ${
                          item.completed
                            ? "border-teal-600 bg-teal-600"
                            : "border-slate-300 bg-white"
                        }`}
                      />
                      <span
                        className={`truncate text-sm ${
                          item.completed
                            ? "text-[var(--muted)] line-through"
                            : "text-slate-700"
                        }`}
                      >
                        {item.text}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(key, item.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      מחיקה
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
    </main>
  );
}
