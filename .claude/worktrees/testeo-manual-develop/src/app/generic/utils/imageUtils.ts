/** Lee un archivo como data URL. Rechaza si el archivo no se puede leer. */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/** Quita el prefijo `data:...;base64,` — el backend espera el contenido crudo. */
export function quitarPrefijoBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;]+;base64,/, '');
}
