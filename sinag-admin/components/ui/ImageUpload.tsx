"use client";

// components/ui/ImageUpload.tsx
import { FC, useState, useRef, DragEvent } from "react";
import { Upload, X, Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  required?: boolean;
  accept?: string;
  maxSizeMB?: number;
}

export const ImageUpload: FC<ImageUploadProps> = ({
  value,
  onChange,
  label = "Upload Image",
  required = false,
  accept = "image/*",
  maxSizeMB = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith("image/")) {
      return "Please upload an image file";
    }

    // Check file size (default 10MB)
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // Upload to API route
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      onChange(data.ipfsUrl);
    } catch (err: any) {
      setError(err.message || "Failed to upload image. Please try again.");
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {!value ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-200
            ${
              isDragging
                ? "border-blue-500 dark:border-[#D4AF37] bg-blue-50 dark:bg-[#D4AF37]/10"
                : "border-slate-300 dark:border-white/20 hover:border-slate-400 dark:hover:border-white/30 bg-slate-50 dark:bg-[#0a0a0a]"
            }
            ${isUploading ? "pointer-events-none opacity-50" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-[#D4AF37] animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Uploading to IPFS...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  PNG, JPG, GIF up to {maxSizeMB}MB
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative group">
          <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a]">
            <img
              src={value}
              alt="Uploaded"
              className="w-full h-64 object-cover"
              onError={() => setError("Failed to load image")}
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={isUploading}
              className="absolute top-2 right-2 p-2 rounded-full bg-red-500 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ImageIcon className="w-4 h-4" />
            <span className="flex-1 truncate">{value}</span>
            {isUploading && (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-[#D4AF37]" />
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};


