/**
 * Upload a file with progress tracking using XMLHttpRequest.
 * Returns a promise that resolves with the parsed JSON response.
 */
export function uploadWithProgress<T = Record<string, unknown>>(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        onProgress(percent)
      }
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data })
      } catch {
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: {} as T })
      }
    }

    xhr.onerror = () => reject(new Error("שגיאת רשת"))
    xhr.ontimeout = () => reject(new Error("הזמן קצוב לבקשה חלף"))

    xhr.open("POST", url)
    xhr.timeout = 120000
    xhr.send(formData)
  })
}
