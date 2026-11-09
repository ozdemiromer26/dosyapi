// Proje fotoğrafı yüklenmeden önce tarayıcıda küçültülür. Yeniden kodlama EXIF
// bilgisini (konum dahil) siler; sunucuya yalnızca piksel verisi gider.

export async function shrinkPhoto(file: Blob, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/jpeg", 0.85));
  } finally {
    bitmap.close();
  }
}
