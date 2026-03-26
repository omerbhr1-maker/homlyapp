"use client";

import { memo } from "react";
import { MicIcon, AudioWaveIcon } from "@/components/icons";
import {
  getRecipeQuestionKind,
  getRecipeAnswerValues,
  isRecipeAnswerMissing,
} from "@/lib/utils";
import type { RecipeQuestion, RecipeAnswerValue } from "@/types";

type RecipeModalProps = {
  recipeText: string;
  onRecipeTextChange: (value: string) => void;
  recipeQuestions: RecipeQuestion[];
  recipeAnswers: Record<string, RecipeAnswerValue>;
  onRecipeAnswerChange: (questionId: string, value: RecipeAnswerValue) => void;
  recipeItems: string[];
  recipeNotes: string;
  recipeError: string;
  isRecipeLoading: boolean;
  recipeRecording: boolean;
  onToggleRecording: () => void;
  onRunRecipe: () => void;
  onAddToSupermarket: () => void;
  onClose: () => void;
};

export const RecipeModal = memo(function RecipeModal({
  recipeText,
  onRecipeTextChange,
  recipeQuestions,
  recipeAnswers,
  onRecipeAnswerChange,
  recipeItems,
  recipeNotes,
  recipeError,
  isRecipeLoading,
  recipeRecording,
  onToggleRecording,
  onRunRecipe,
  onAddToSupermarket,
  onClose,
}: RecipeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 dark:bg-black/70 p-2 sm:items-center sm:p-3">
      <div className="max-h-[88dvh] w-full max-w-[min(100vw-0.75rem,36rem)] overflow-y-auto rounded-3xl border border-white/70 dark:border-slate-700/70 bg-white dark:bg-slate-800 p-4 shadow-2xl dark:shadow-slate-900/50 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">מתכון חכם לסופר</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            סגור
          </button>
        </div>

        <div className="flex gap-2">
          <textarea
            value={recipeText}
            onChange={(event) => onRecipeTextChange(event.target.value)}
            placeholder="כתוב או הדבק מתכון מלא..."
            className="min-h-24 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
          />
          <button
            type="button"
            onClick={onToggleRecording}
            className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
              recipeRecording
                ? "border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-200"
                : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            } transition`}
            title={recipeRecording ? "עצור הקלטה" : "הקלטת מתכון"}
            aria-label={recipeRecording ? "עצור הקלטה" : "הקלטת מתכון"}
          >
            {recipeRecording ? <AudioWaveIcon /> : <MicIcon />}
          </button>
        </div>
        {recipeRecording && (
          <p className="mt-2 rounded-xl bg-rose-50 dark:bg-red-900/30 px-3 py-2 text-xs font-bold text-rose-600">מקליט... לעצירת ההקלטה לחץ שוב.</p>
        )}

        {recipeQuestions.length > 0 && (
          <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              ענה על כל השאלות ולחץ ״המשך ניתוח״.
            </p>
            {recipeQuestions.map((question) => (
              <div key={question.id} className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                  {question.title}
                </span>
                {getRecipeQuestionKind(question) === "multi" &&
                question.options &&
                question.options.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {question.options.map((option) => {
                        const selectedValues = getRecipeAnswerValues(recipeAnswers[question.id]);
                        const selected = selectedValues.includes(option);
                        const reachedLimit =
                          Boolean(question.maxSelections) &&
                          selectedValues.length >= Number(question.maxSelections);
                        return (
                          <button
                            key={`${question.id}-${option}`}
                            type="button"
                            onClick={() => {
                              const values = getRecipeAnswerValues(recipeAnswers[question.id]);
                              const isSelected = values.includes(option);
                              if (isSelected) {
                                onRecipeAnswerChange(
                                  question.id,
                                  values.filter((value) => value !== option),
                                );
                              } else if (!question.maxSelections || values.length < question.maxSelections) {
                                onRecipeAnswerChange(question.id, [...values, option]);
                              }
                            }}
                            disabled={!selected && reachedLimit}
                            className={`min-h-10 rounded-xl border px-2 text-xs font-bold transition ${
                              selected
                                ? "border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400"
                                : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                            } disabled:opacity-50`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                      אפשר לבחור עד {question.maxSelections || question.options.length} אפשרויות
                    </p>
                  </>
                ) : getRecipeQuestionKind(question) === "single" &&
                  question.options &&
                  question.options.length > 0 ? (
                  <select
                    value={
                      Array.isArray(recipeAnswers[question.id])
                        ? getRecipeAnswerValues(recipeAnswers[question.id])[0] || ""
                        : String(recipeAnswers[question.id] || "")
                    }
                    onChange={(event) => onRecipeAnswerChange(question.id, event.target.value)}
                    className="min-h-10 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
                  >
                    <option value="">בחר...</option>
                    {question.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={
                      Array.isArray(recipeAnswers[question.id])
                        ? String(recipeAnswers[question.id])
                        : String(recipeAnswers[question.id] || "")
                    }
                    onChange={(event) => onRecipeAnswerChange(question.id, event.target.value)}
                    className="min-h-10 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
                    placeholder="הקלד תשובה"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onRunRecipe}
            disabled={
              isRecipeLoading ||
              (recipeQuestions.length > 0 &&
                recipeQuestions.some((question) =>
                  isRecipeAnswerMissing(question, recipeAnswers[question.id]),
                ))
            }
            className="min-h-11 flex-1 rounded-2xl bg-gradient-to-l from-teal-600 to-cyan-600 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {isRecipeLoading
              ? "מנתח..."
              : recipeQuestions.length > 0
                ? "המשך ניתוח"
                : "נתח מתכון"}
          </button>
        </div>

        {recipeNotes && recipeQuestions.length === 0 && (
          <p className="mt-2 rounded-xl bg-amber-50 dark:bg-yellow-900/30 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
            {recipeNotes}
          </p>
        )}
        {recipeError && (
          <p className="mt-2 rounded-xl bg-rose-50 dark:bg-red-900/30 px-3 py-2 text-xs font-bold text-rose-700">
            {recipeError}
          </p>
        )}

        {recipeItems.length > 0 && (
          <div className="mt-3 rounded-2xl border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/40 p-3">
            <p className="text-xs font-bold text-teal-800 dark:text-teal-300">רשימת קניות מוכנה:</p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-auto text-sm text-slate-700 dark:text-slate-200">
              {recipeItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onAddToSupermarket}
              className="mt-3 min-h-10 w-full rounded-xl bg-slate-900 dark:bg-slate-700 px-4 text-xs font-bold text-white transition hover:bg-slate-800 dark:hover:bg-slate-600"
            >
              הוסף הכול לרשימת הסופר
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
