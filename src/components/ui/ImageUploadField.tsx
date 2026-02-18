"use client";

import Image from "next/image";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";

type ImageUploadFieldProps = {
  previews: string[];
  inputRef: { current: HTMLInputElement | null };
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  onContainerClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onContainerKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onInputClick?: (event: MouseEvent<HTMLInputElement>) => void;
  onInputFocus?: () => void;
  inputName?: string;
  label?: string;
  maxCountLabel?: string;
  emptyText?: string;
  helperText?: ReactNode;
};

export default function ImageUploadField({
  previews,
  inputRef,
  onInputChange,
  onRemove,
  onPaste,
  onContainerClick,
  onContainerKeyDown,
  onInputClick,
  onInputFocus,
  inputName = "image",
  label = "사진",
  maxCountLabel = "최대 10개",
  emptyText = "사진을 등록해주세요. (선택사항, 여러 장 선택 가능)",
  helperText,
}: ImageUploadFieldProps) {
  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2">
        <span className="form-label">
          {label} <span className="form-label-optional">({maxCountLabel})</span>
        </span>
        <div
          className="image-upload-area"
          onClick={(event) => {
            if (onContainerClick) {
              onContainerClick(event);
              return;
            }
            if ((event.target as HTMLElement).tagName === "INPUT") {
              return;
            }
            inputRef.current?.click();
          }}
          onPaste={onPaste}
          tabIndex={0}
          onKeyDown={(event) => {
            if (onContainerKeyDown) {
              onContainerKeyDown(event);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          {previews.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {previews.map((preview, index) => (
                <div key={`${preview}-${index}`} className="group relative">
                  <Image
                    src={preview}
                    alt={`미리보기 ${index + 1}`}
                    width={400}
                    height={300}
                    className="w-full aspect-[4/3] rounded-lg border border-neutral-200 object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs text-white opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    aria-label="이미지 삭제"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-1 left-1 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                    {index + 1}/{previews.length}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="image-upload-placeholder">{emptyText}</div>
          )}
          <input
            ref={inputRef}
            name={inputName}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={onInputChange}
            onClick={onInputClick}
            onFocus={onInputFocus}
            className="image-upload-input"
          />
        </div>
        {helperText ? <p className="text-xs text-neutral-500">{helperText}</p> : null}
      </label>
    </div>
  );
}
