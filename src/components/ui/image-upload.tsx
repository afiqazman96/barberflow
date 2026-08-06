"use client";

import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 700_000;

export async function readImageAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (PNG, JPG, or WebP)");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large — keep under ~700KB");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  hint = "PNG, JPG or WebP · max ~700KB",
  className,
  previewClassName,
}: {
  value?: string;
  onChange: (next: string | undefined) => void;
  label?: string;
  hint?: string;
  className?: string;
  previewClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)] transition hover:border-[var(--gold-dim)] hover:bg-[var(--bg-hover)]",
            previewClassName,
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-[var(--text-faint)]">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px] font-medium">Upload</span>
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <p className="text-xs text-[var(--text-faint)]">{hint}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {value ? "Replace" : "Choose"}
            </Button>
            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onChange(undefined)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
