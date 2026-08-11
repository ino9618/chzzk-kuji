export async function resizeUploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 선택할 수 있습니다.');
  if (file.size > 5 * 1024 * 1024) throw new Error('이미지는 5MB 이하만 등록할 수 있습니다.');
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      element.src = source;
    });
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.82);
  } finally {
    URL.revokeObjectURL(source);
  }
}
