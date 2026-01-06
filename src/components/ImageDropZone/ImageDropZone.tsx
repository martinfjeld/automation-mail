import React, { useState, useCallback } from "react";
import styles from "./ImageDropZone.module.scss";

interface ImageDropZoneProps {
  onImagesChange: (images: File[]) => void;
  onError?: (error: string) => void;
}

const ImageDropZone: React.FC<ImageDropZoneProps> = ({ onImagesChange, onError }) => {
  const [images, setImages] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const validateMockupFilenames = (files: File[]): { valid: boolean; error?: string } => {
    const validNames = [
      "1_mockup.jpg", "2_mockup.jpg", "3_mockup.jpg", "4_mockup.jpg",
      "1.jpg", "2.jpg"
    ];
    const fileNames = files.map(f => f.name.toLowerCase());
    
    // Check if all files are valid names
    const allValid = fileNames.every(name => validNames.includes(name));
    
    if (!allValid) {
      return {
        valid: false,
        error: "The image names needs to be of type mockup (1_mockup.jpg, 2_mockup.jpg, etc.) or before/after (1.jpg, 2.jpg)"
      };
    }
    
    return { valid: true };
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (files.length > 0) {
        const validation = validateMockupFilenames(files);
        
        if (!validation.valid) {
          if (onError) {
            onError(validation.error!);
          }
          return;
        }
        
        const updatedImages = [...images, ...files];
        setImages(updatedImages);
        onImagesChange(updatedImages);
      }
    },
    [images, onImagesChange, onError]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((file) =>
        file.type.startsWith("image/")
      );

      if (files.length > 0) {
        const validation = validateMockupFilenames(files);
        
        if (!validation.valid) {
          if (onError) {
            onError(validation.error!);
          }
          // Clear the input
          e.target.value = "";
          return;
        }
        
        const updatedImages = [...images, ...files];
        setImages(updatedImages);
        onImagesChange(updatedImages);
      }
    },
    [images, onImagesChange, onError]
  );

  const removeImage = useCallback(
    (index: number) => {
      const updatedImages = images.filter((_, i) => i !== index);
      setImages(updatedImages);
      onImagesChange(updatedImages);
    },
    [images, onImagesChange]
  );

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className={styles.fileInput}
          id="image-upload"
        />
        <label htmlFor="image-upload" className={styles.label}>
          <svg
            className={styles.icon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p>Drag and drop images here, or click to select</p>
        </label>
      </div>

      {images.length > 0 && (
        <div className={styles.imageList}>
          {images.map((image, index) => (
            <div key={index} className={styles.imagePreview}>
              <img
                src={URL.createObjectURL(image)}
                alt={`Preview ${index + 1}`}
              />
              <button
                onClick={() => removeImage(index)}
                className={styles.removeButton}
                type="button"
              >
                ×
              </button>
              <p className={styles.imageName}>{image.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageDropZone;
